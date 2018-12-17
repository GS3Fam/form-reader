let mongoose = require('mongoose');

function appDataModel(id) {
  let appDataSchema = new mongoose.Schema({}, {strict: false, collection: id});
  return mongoose.model(id, appDataSchema);
}

module.exports = appDataModel;
