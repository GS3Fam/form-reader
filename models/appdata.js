let
  mongoose = require('mongoose');
  appDataSchema = new mongoose.Schema({}, {strict: false});

function appDataModel(id) {
  return mongoose.model(id, appDataSchema, id);
}

module.exports = appDataModel;
