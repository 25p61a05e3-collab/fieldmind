import type {
  DemoSession,
  IncidentRecord,
  ResolutionRecord,
  ProviderStatus,
} from "@shared/types";
import { MongoClient, type Db } from "mongodb";

const equipmentCatalog = [
  {
    equipmentId: "P-204",
    name: "Process Pump 204",
    type: "Centrifugal pump",
    model: "FlowMax 420",
    location: "North process bay",
    status: "operational",
  },
  {
    equipmentId: "P-207",
    name: "Process Pump 207",
    type: "Centrifugal pump",
    model: "FlowMax 420",
    location: "North process bay",
    status: "operational",
  },
  {
    equipmentId: "P-301",
    name: "Transfer Pump 301",
    type: "Positive displacement pump",
    model: "TorqueLine 310",
    location: "Blending skid",
    status: "operational",
  },
  {
    equipmentId: "C-102",
    name: "Compressor 102",
    type: "Rotary screw compressor",
    model: "AirCore 102",
    location: "Utilities room",
    status: "operational",
  },
  {
    equipmentId: "M-115",
    name: "Mixer 115",
    type: "Agitator mixer",
    model: "BlendPro 115",
    location: "Batch hall",
    status: "maintenance due",
  },
];

const memoryIncidents: IncidentRecord[] = [];
const memoryResolutions: ResolutionRecord[] = [];
const memorySessions = new Map<string, DemoSession>();
let client: MongoClient | null = null;
let database: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

const mongoUri = () => process.env.MONGODB_URI?.trim();
const dbName = () => process.env.MONGODB_DB_NAME?.trim() || "fieldmind";

export function mongoProviderStatus(): ProviderStatus {
  return mongoUri() ? "connected" : "not_configured";
}

async function getDb(): Promise<Db> {
  if (!mongoUri()) throw new Error("MongoDB is not configured");
  if (database) return database;
  if (!connectionPromise) {
    client = new MongoClient(mongoUri()!, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });
    connectionPromise = client
      .connect()
      .then(connection => {
        database = connection.db(dbName());
        return database;
      })
      .catch(error => {
        connectionPromise = null;
        database = null;
        throw error;
      });
  }
  return connectionPromise;
}

export async function checkMongo(): Promise<ProviderStatus> {
  if (!mongoUri()) return "not_configured";
  try {
    await (await getDb()).command({ ping: 1 });
    return "connected";
  } catch (error) {
    console.error("MongoDB health check failed", error);
    return "unavailable";
  }
}

export function getEquipment(equipmentId: string) {
  return equipmentCatalog.find(item => item.equipmentId === equipmentId);
}

export async function countIncidents(demoSessionId?: string): Promise<number> {
  try {
    const db = await getDb();
    return await db
      .collection<IncidentRecord>("incidents")
      .countDocuments(demoSessionId ? { demoSessionId } : {});
  } catch {
    return memoryIncidents.filter(incident =>
      demoSessionId ? incident.demoSessionId === demoSessionId : true
    ).length;
  }
}

export async function insertIncident(
  incident: IncidentRecord
): Promise<IncidentRecord> {
  try {
    const db = await getDb();
    await db.collection<IncidentRecord>("incidents").insertOne(incident);
    return { ...incident, persistenceStatus: "mongodb" };
  } catch (error) {
    if (mongoUri())
      console.error(
        "MongoDB incident insert failed; using ephemeral preview state",
        error
      );
    memoryIncidents.push(incident);
    return { ...incident, persistenceStatus: "ephemeral" };
  }
}

export async function updateIncident(
  id: string,
  patch: Partial<IncidentRecord>
): Promise<IncidentRecord | null> {
  try {
    const db = await getDb();
    const result = await db
      .collection<IncidentRecord>("incidents")
      .findOneAndUpdate({ id }, { $set: patch }, { returnDocument: "after" });
    return result ? { ...result, persistenceStatus: "mongodb" } : null;
  } catch {
    const index = memoryIncidents.findIndex(incident => incident.id === id);
    if (index === -1) return null;
    memoryIncidents[index] = { ...memoryIncidents[index], ...patch };
    return { ...memoryIncidents[index], persistenceStatus: "ephemeral" };
  }
}

export async function getIncident(id: string): Promise<IncidentRecord | null> {
  try {
    const db = await getDb();
    const result = await db
      .collection<IncidentRecord>("incidents")
      .findOne({ id });
    return result ? { ...result, persistenceStatus: "mongodb" } : null;
  } catch {
    const result = memoryIncidents.find(incident => incident.id === id);
    return result ? { ...result, persistenceStatus: "ephemeral" } : null;
  }
}

export async function insertResolution(
  resolution: ResolutionRecord
): Promise<ResolutionRecord> {
  try {
    const db = await getDb();
    await db.collection<ResolutionRecord>("resolutions").insertOne(resolution);
    return { ...resolution, persistenceStatus: "mongodb" };
  } catch (error) {
    if (mongoUri())
      console.error(
        "MongoDB resolution insert failed; using ephemeral preview state",
        error
      );
    memoryResolutions.push(resolution);
    return { ...resolution, persistenceStatus: "ephemeral" };
  }
}

export async function getResolutionForIncident(
  incidentId: string
): Promise<ResolutionRecord | null> {
  try {
    const db = await getDb();
    const result = await db
      .collection<ResolutionRecord>("resolutions")
      .findOne({ incidentId });
    return result ? { ...result, persistenceStatus: "mongodb" } : null;
  } catch {
    const result = memoryResolutions.find(
      resolution => resolution.incidentId === incidentId
    );
    return result ? { ...result, persistenceStatus: "ephemeral" } : null;
  }
}

export async function listEquipmentHistory(equipmentId: string) {
  try {
    const db = await getDb();
    const [incidents, resolutions] = await Promise.all([
      db
        .collection<IncidentRecord>("incidents")
        .find({ equipmentId })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray(),
      db
        .collection<ResolutionRecord>("resolutions")
        .find({})
        .sort({ resolvedAt: -1 })
        .limit(60)
        .toArray(),
    ]);
    const incidentIds = new Set(incidents.map(incident => incident.id));
    return {
      incidents: incidents.map(incident => ({
        ...incident,
        persistenceStatus: "mongodb" as const,
      })),
      resolutions: resolutions
        .filter(resolution => incidentIds.has(resolution.incidentId))
        .map(resolution => ({
          ...resolution,
          persistenceStatus: "mongodb" as const,
        })),
      persistenceStatus: "mongodb" as const,
    };
  } catch {
    const incidents = memoryIncidents
      .filter(incident => incident.equipmentId === equipmentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const incidentIds = new Set(incidents.map(incident => incident.id));
    return {
      incidents: incidents.map(incident => ({
        ...incident,
        persistenceStatus: "ephemeral" as const,
      })),
      resolutions: memoryResolutions
        .filter(resolution => incidentIds.has(resolution.incidentId))
        .map(resolution => ({
          ...resolution,
          persistenceStatus: "ephemeral" as const,
        })),
      persistenceStatus: "ephemeral" as const,
    };
  }
}

export async function listRecentResolutions(
  limit = 20
): Promise<ResolutionRecord[]> {
  try {
    const db = await getDb();
    const results = await db
      .collection<ResolutionRecord>("resolutions")
      .find({})
      .sort({ resolvedAt: -1 })
      .limit(limit)
      .toArray();
    return results.map(result => ({
      ...result,
      persistenceStatus: "mongodb" as const,
    }));
  } catch {
    return memoryResolutions
      .slice()
      .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt))
      .slice(0, limit)
      .map(result => ({ ...result, persistenceStatus: "ephemeral" as const }));
  }
}

export async function createDemoSession(
  session: DemoSession
): Promise<DemoSession> {
  try {
    const db = await getDb();
    await db.collection<DemoSession>("demo_sessions").insertOne(session);
  } catch {
    memorySessions.set(session.id, session);
  }
  return session;
}

export async function getDemoSession(id: string): Promise<DemoSession | null> {
  try {
    const db = await getDb();
    return await db.collection<DemoSession>("demo_sessions").findOne({ id });
  } catch {
    return memorySessions.get(id) ?? null;
  }
}

export async function updateDemoSession(
  id: string,
  patch: Partial<DemoSession>
): Promise<DemoSession | null> {
  try {
    const db = await getDb();
    const result = await db
      .collection<DemoSession>("demo_sessions")
      .findOneAndUpdate({ id }, { $set: patch }, { returnDocument: "after" });
    return result;
  } catch {
    const current = memorySessions.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    memorySessions.set(id, next);
    return next;
  }
}

export function equipmentCatalogSnapshot() {
  return equipmentCatalog;
}
