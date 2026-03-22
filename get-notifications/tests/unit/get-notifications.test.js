import { jest } from '@jest/globals';

const mockDocSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {}
}));

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({
      send: mockDocSend
    })
  },
  QueryCommand: class {
    constructor(input) {
      this.input = input;
    }
  }
}));

const { lambdaHandler } = await import('../../app.mjs');

describe('get notifications handler', () => {
  beforeEach(() => {
    process.env.NOTIFICATIONS_TABLE_NAME = 'notifications';
    mockDocSend.mockReset();
    mockDocSend.mockResolvedValue({
      Items: [
        {
          recipient: 'Harry Potter',
          message: 'Owl delivery',
          id: '123',
          status: 'queued',
          createdAt: '2026-03-20T19:09:04.302Z'
        }
      ]
    });
  });

  test('returns 200 with notifications', async () => {
    const event = {
      pathParameters: { recipient: 'Harry%20Potter' },
      queryStringParameters: null
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].recipient).toBe('Harry Potter');
    expect(mockDocSend).toHaveBeenCalled();
  });

  test('returns 400 for missing recipient', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: null
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('recipient path parameter is required');
  });

  test('returns 400 for invalid limit', async () => {
    const event = {
      pathParameters: { recipient: 'Harry%20Potter' },
      queryStringParameters: { limit: '0' }
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('limit must be a positive integer');
  });
});