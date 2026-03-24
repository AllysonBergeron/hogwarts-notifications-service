import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const lambdaHandler = async (event) => {
  const results = [];

  for (const record of event.Records || []) {
    try {
      const notification = JSON.parse(record.body);

      await docClient.send(
        new UpdateCommand({
          TableName: process.env.NOTIFICATIONS_TABLE_NAME,
          Key: {
            recipient: notification.recipient,
            createdAt: notification.createdAt
          },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'delivered'
          }
        })
      );

      results.push({ recordId: record.messageId, status: 'success' });
    } catch (error) {
      console.error(`Error processing record ${record.messageId}:`, error);
      results.push({ recordId: record.messageId, status: 'failed', error: error.message });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Batch processing complete',
      results
    })
  };
};