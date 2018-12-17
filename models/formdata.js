let
  mongoose = require('mongoose'),
  schema = mongoose.Schema({
    appId: String,
    _app: {
      appId: String,
      caption: String,
      image: String,
      sequence: String,
      status: Boolean,
      access: String,
      customhtml: String,
      mobileCheck: Boolean,
      mobileKeyRef1: String,
      mobileKeyRef2: String
    },
    columns: { type : Array , "default" : [] }
  });

let model = module.exports = mongoose.model('formdata', schema, 'formdata');
