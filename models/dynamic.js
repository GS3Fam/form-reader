let mongoose = require('mongoose');

function dynamicModel(id) {

  let dynamicSchema = new mongoose.Schema({
    name: String
  });

  return mongoose.model(id, dynamicSchema);

}

module.exports = dynamicModel;
