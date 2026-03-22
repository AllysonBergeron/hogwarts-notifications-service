import { jest } from '@jest/globals';

const mockDocSend = jest.fn();
const mockSqsSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {}
}));

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({
      send: mockDocSend
    })
  },
  PutCommand: class {
    constructor(input) {
      this.input = input;
    }
  }
}));

jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send = mockSqsSend;
  },
  SendMessageCommand: class {
    constructor(input) {
      this.input = input;
    }
  }
}));

const { lambdaHandler } = await import('../../app.mjs');

describe('create notification handler', () => {
  beforeEach(() => {
    process.env.NOTIFICATIONS_TABLE_NAME = 'notifications';
    process.env.NOTIFICATIONS_QUEUE_URL = 'https://example.com/queue';
    mockDocSend.mockReset();
    mockSqsSend.mockReset();
    mockDocSend.mockResolvedValue({});
    mockSqsSend.mockResolvedValue({});
  });

  test('returns 201 for valid request', async () => {
    const event = {
      body: JSON.stringify({
        recipient: 'Harry Potter',
        message: 'Owl delivery'
      })
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(201);
    expect(body.recipient).toBe('Harry Potter');
    expect(body.message).toBe('Owl delivery');
    expect(body.status).toBe('queued');
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(mockDocSend).toHaveBeenCalled();
    expect(mockSqsSend).toHaveBeenCalled();
  });

  test('returns 400 for invalid JSON', async () => {
    const event = {
      body: '{bad json'
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('invalid request body');
  });

  test('returns 400 when recipient is missing', async () => {
    const event = {
      body: JSON.stringify({
        message: 'Owl delivery'
      })
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('recipient and message are required');
  });

  test('returns 400 when message is blank', async () => {
    const event = {
      body: JSON.stringify({
        recipient: 'Harry Potter',
        message: '   '
      })
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('recipient and message are required');
  });
});