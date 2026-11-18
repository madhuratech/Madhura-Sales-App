const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:Madhura123@crm.uly9rfv.mongodb.net/?retryWrites=true&w=majority').then(async () => {
  const result = await User.updateMany({}, { $set: { activeSessionTokens: [] } });
  console.log('CLEARED SESSIONS:', result);
  process.exit(0);
});
