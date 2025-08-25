import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = new DynamoDBClient({
  region: "us-west-2",
});
const doc = DynamoDBDocumentClient.from(ddb);

const ALERTS_TABLE = process.env.ALERTS_TABLE || "westfam-alerts";

export interface EventInput {
  seed?: boolean;
}

// Lambda handler: optionally seed a sample alert item in DynamoDB Local.
export const handler = async (_event: EventInput = {}) => {
  // Minimal polygon over a small area (square)
  const feature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-122.6, 45.5],
          [-122.4, 45.5],
          [-122.4, 45.7],
          [-122.6, 45.7],
          [-122.6, 45.5],
        ],
      ],
    },
    properties: {
      id: `sample-${Date.now()}`,
      event: "Test Weather Alert",
      headline: "Local Dev Test Alert",
      severity: "Moderate",
      certainty: "Observed",
      effective: new Date().toISOString(),
      expires: new Date(Date.now() + 3600_000).toISOString(),
    },
  };

  try {
    console.log(
      "[alerts-lambda] putting item",
      feature.properties.id,
      "into table",
      ALERTS_TABLE,
    );
    await doc.send(
      new PutCommand({
        TableName: ALERTS_TABLE,
        Item: {
          pk: feature.properties.id,
          sk: "v0",
          data: feature,
        },
      }),
    );
    console.log("[alerts-lambda] put succeeded", feature.properties.id);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: feature.properties.id }),
    };
  } catch (e: any) {
    console.error("Seed failed", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

// Allow running directly via `node dist/index.js`
// (In ESM, compare import.meta.url to the executed file path)
if (typeof import.meta !== "undefined") {
  try {
    const executed = `file://${process.argv[1]}`;
    if (import.meta.url === executed) {
      handler()
        .then((r) => {
          console.log("[alerts-lambda] handler result", r);
        })
        .catch((err) => {
          console.error("[alerts-lambda] handler error", err);
          process.exitCode = 1;
        });
    }
  } catch {
    /* ignore */
  }
}
