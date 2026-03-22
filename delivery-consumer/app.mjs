import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const lambdaHandler = async (event) => {
  try {
    for (const record of event.Records || []) {
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
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'processed messages successfully'
      })
    };
  } catch (error) {
    console.error('Error processing notification queue:', error);

    throw error;
  }
};