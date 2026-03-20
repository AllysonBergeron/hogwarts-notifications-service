import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const lambdaHandler = async (event) => {
  const rawRecipient = event.pathParameters?.recipient;
  const recipient = rawRecipient ? decodeURIComponent(rawRecipient) : rawRecipient;
  const limitParam = event.queryStringParameters?.limit;

  if (!recipient || recipient.trim() === '') {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'recipient path parameter is required'
      })
    };
  }

  let limit;

  if (limitParam !== undefined) {
    limit = Number(limitParam);

    if (!Number.isInteger(limit) || limit <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'limit must be a positive integer'
        })
      };
    }
  }

  try {
    const command = new QueryCommand({
      TableName: process.env.NOTIFICATIONS_TABLE_NAME,
      KeyConditionExpression: 'recipient = :recipient',
      ExpressionAttributeValues: {
        ':recipient': recipient.trim()
      },
      Limit: limit,
      ScanIndexForward: false
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items || [])
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to fetch notifications'
      })
    };
  }
};