/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

export const lambdaHandler = async (event) => {
  let requestBody;

  try {
    requestBody = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'invalid request body'
      })
    };
  }

  const { recipient, message } = requestBody;

  if (
    typeof recipient !== 'string' ||
    typeof message !== 'string' ||
    recipient.trim() === '' ||
    message.trim() === ''
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'recipient and message are required'
      })
    };
  }

  const notification = {
    id: crypto.randomUUID(),
    recipient: recipient.trim(),
    message: message.trim(),
    status: 'queued',
    createdAt: new Date().toISOString()
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.NOTIFICATIONS_TABLE_NAME,
        Item: notification
      })
    );

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.NOTIFICATIONS_QUEUE_URL,
        MessageBody: JSON.stringify(notification)
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify(notification)
    };

  } catch (error) {
    console.error('Error creating notification:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to create notification'
      })
    };
  }
};