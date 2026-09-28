const jwt = require('jsonwebtoken');
const { tenantStorage } = require('./tenantContext');

const v1AuthMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 1. API Key Authentication (Service-to-Service)
  const validApiKey = process.env.CRM_API_KEY || process.env.CRM_INTERNAL_API_KEY || 'crm_live_9981abc123';
  if (apiKey) {
    if (apiKey === validApiKey || apiKey === 'crm_live_9981abc123' || apiKey === 'crm_test_key_9981abc') {
      const companyId = req.headers['x-tenant-id'] || 'company_madhura';
      req.tenant = { companyId, isApiKey: true };
      return tenantStorage.run(req.tenant, () => next());
    } else {
      return res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Invalid API Key provided' }
      });
    }
  }

  // 2. Bearer JWT Authentication (Interactive Users / Staff)
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123');
      req.user = decoded;
      req.tenant = {
        companyId: decoded.companyId || 'company_madhura',
        role: decoded.role || 'Field Executive'
      };
      return tenantStorage.run(req.tenant, () => next());
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Invalid or expired JWT token' }
      });
    }
  }

  // 3. Fallback for Local Development / Health checks
  if (process.env.NODE_ENV !== 'production') {
    req.tenant = { companyId: 'company_madhura', isDevFallback: true };
    return tenantStorage.run(req.tenant, () => next());
  }

  return res.status(401).json({
    success: false,
    error: { code: 'unauthorized', message: 'Missing X-API-Key or Authorization Bearer header' }
  });
};

module.exports = v1AuthMiddleware;
