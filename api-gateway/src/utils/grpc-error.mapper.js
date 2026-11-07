const grpc = require('@grpc/grpc-js');

function handleGrpcError(res, err) {
  const code = err.code;
  const message = err.details || err.message || 'Internal Server Error';

  switch (code) {
    case grpc.status.INVALID_ARGUMENT:
      return res.status(400).json({ error: message });
    case grpc.status.UNAUTHENTICATED:
      return res.status(401).json({ error: message });
    case grpc.status.PERMISSION_DENIED:
      return res.status(403).json({ error: message });
    case grpc.status.NOT_FOUND:
      return res.status(404).json({ error: message });
    case grpc.status.ALREADY_EXISTS:
    case grpc.status.ABORTED:
    case grpc.status.FAILED_PRECONDITION:
      return res.status(409).json({ error: message });
    case grpc.status.UNAVAILABLE:
      return res.status(503).json({ error: 'Downstream microservice unavailable' });
    default:
      return res.status(500).json({ error: message });
  }
}

module.exports = { handleGrpcError };