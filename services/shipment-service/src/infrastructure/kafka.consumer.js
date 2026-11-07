const { Kafka, logLevel } = require('kafkajs');
const shipmentUseCase = require('../application/shipment.usecase');

const kafka = new Kafka({
  clientId: 'shipment-service',
  brokers: (process.env.KAFKA_BROKERS || '127.0.0.1:9092').split(','),
  logLevel: logLevel.ERROR,
});

const consumer = kafka.consumer({ groupId: 'shipment-service-group' });

async function startKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-created', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const rawValue = message.value ? message.value.toString() : '{}';
        const payload = JSON.parse(rawValue);
        const { shipment, createdNew } = await shipmentUseCase.handleOrderCreatedEvent(payload);
        if (createdNew) {
          console.log(
            `[Shipment Service] Created new Shipment shipid=${shipment.shipid} for oid=${shipment.oid} (status=${shipment.status})`
          );
        } else {
          console.log(
            `[Shipment Service] Idempotent skip: Shipment for oid=${shipment.oid} already exists (shipid=${shipment.shipid})`
          );
        }
      } catch (err) {
        console.error(`[Shipment Service] Rejected invalid Kafka event: ${err.message}`);
      }
    },
  });

  console.log('[Shipment Service] Kafka Consumer listening on topic "order-created".');
}

module.exports = { startKafkaConsumer };