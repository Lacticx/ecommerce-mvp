const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('[Order Service] Connected to Kafka Producer.');
  }
}

async function publishOrderCreatedEvent(eventPayload) {
  await connectProducer();
  await producer.send({
    topic: 'order-created',
    messages: [
      {
        key: String(eventPayload.oid),
        value: JSON.stringify(eventPayload),
      },
    ],
  });
}

module.exports = {
  connectProducer,
  publishOrderCreatedEvent,
};