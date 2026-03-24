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
  UpdateCommand: class {
    constructor(input) {
      this.input = input;
    }
  }
}));

const { lambdaHandler } = await import('../../app.mjs');

describe('delivery-consumer handler', () => {
  beforeEach(() => {
    process.env.NOTIFICATIONS_TABLE_NAME = 'notifications';
    mockDocSend.mockReset();
    mockDocSend.mockResolvedValue({});
  });

  test('processes valid SQS message', async () => {
    const event = {
      Records: [
        {
          body: JSON.stringify({
            recipient: 'Harry Potter',
            createdAt: '2026-03-20T19:09:04.302Z'
          })
        }
      ]
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.message).toBe('Batch processing complete');
    expect(mockDocSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: 'notifications',
          Key: {
            recipient: 'Harry Potter',
            createdAt: '2026-03-20T19:09:04.302Z'
          },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeValues: {
            ':status': 'delivered'
          },
          ExpressionAttributeNames: {
            '#status': 'status'
          }
        }
      })
    );
  });

  test('handles invalid SQS message gracefully', async () => {
    const event = {
      Records: [
        {
          body: '{bad json}'
        }
      ]
    };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.message).toBe('Batch processing complete');
    expect(body.results).toEqual([
      {
        recordId: undefined,
        status: 'failed',
        error: expect.stringContaining('Unexpected token')
      }
    ]);
    expect(mockDocSend).not.toHaveBeenCalled();
  });

  test('handles empty Records array', async () => {
    const event = { Records: [] };

    const response = await lambdaHandler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.message).toBe('Batch processing complete');
    expect(mockDocSend).not.toHaveBeenCalled();
  });
});