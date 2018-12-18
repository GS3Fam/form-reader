const
  electron = require('electron'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  {app, BrowserWindow, Menu, ipcMain} = electron,
  mongoose = require("mongoose"),
  makeId = require('./modules/makeId'),
  _ = require('lodash');

mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true});

// Models
let FormData = require("./models/formdata");
let AppData = require("./models/appdata");

// Windows
let w_main;

// Initial ---------------------------------------------------------------------

app.on('ready', ()=>{
  fWindowMain();
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
});

// Windows ---------------------------------------------------------------------

function fWindowMain(){
  w_main = new BrowserWindow({icon:path.join(__dirname, 'images', 'title_pic.png')})
  w_main.loadURL(url.format({
    pathname: path.join(__dirname, 'view', 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  w_main.on('closed', ()=>{
    app.quit()
  })
}

// Events ----------------------------------------------------------------------

function syncData(){

}

ipcMain.on('form:getAll', (e)=>{

  // let json1 = fs.readFileSync(path.join(__dirname, '_formdata', 'Equipment Concerns.json'), {encoding: "utf8"});
  // let json2 = fs.readFileSync(path.join(__dirname, '_formdata', 'Equipment Concerns2.json'), {encoding: "utf8"});
  //
  // _.isEqual(json1, json2) ? console.log('=') : console.log('!=')

  // console.log(mongoose.connection.readyState)

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND"){
      mongoose.connection.close()
      // get all filenames
      fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
        // filter: JSON files
        files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
        // get JSON properties
        let files_doc = files.reduce((temp, file, i)=>{
          let data = fs.readFileSync(path.join(__dirname, '_formdata', file), {encoding: "utf8"});
          if(JSON.parse(data)._app){
            let { appId, caption } = JSON.parse(data)._app;
            temp.push({ appId: appId, caption: caption, filename: file });
          }
          return temp;
        },[])

        w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: false}) : 0
      })
    }
    else{
      // mongoose: connect if not connected
      mongoose.connection.readyState == 0 ?
        mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0
      // mongoose: if connected
      if(mongoose.connection.readyState == 1){
        syncData();

        FormData.find().sort({"_app.caption": 1}).exec().then(formdata =>{
          if(formdata){
            let files_doc = formdata.reduce((temp, data, i)=>{
              let {appId, caption} = data._app
              temp.push({ appId: appId, caption : caption, filename : null })
              return temp;
            },[])
            w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: true}) : 0
          }
          else{
            w_main ? w_main.webContents.send('form:empty') : 0
          }
        })
        .catch(err =>{
          console.log(err)
        })
      }
    }
  })

});

ipcMain.on('form:getInitial', (e)=>{

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND"){
      mongoose.connection.close()
      // get all filenames
      fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
        // filter: JSON files
        files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
        // get first JSON
        if(files[0]){
          fs.readFile(path.join(__dirname, '_formdata', files[0]), 'utf8', function (err, data) {
            if (err) throw err;

            w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
          });
        }
        else{
          w_main ? w_main.webContents.send('form:empty') : 0
        }
      })
    }
    else{
      // mongoose: connect if not connected
      mongoose.connection.readyState == 0 ?
        mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0
      // mongoose: if connected/connecting
      if(mongoose.connection.readyState == 1 || mongoose.connection.readyState == 2){
        FormData.find().then(formdata=>{
          w_main ?
            formdata ?
              formdata[0] ?
                w_main.webContents.send('form:getOne', formdata) :
                w_main.webContents.send('form:empty')
              : w_main.webContents.send('form:empty')
            : 0
        })
        .catch(err =>{
          console.log(err)
        })
      }
    }
  });

});

ipcMain.on('form:getOne', (e, json)=>{

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND" && json.filename){
      mongoose.connection.close()
      // get selected JSON
      fs.readFile(path.join(__dirname, '_formdata', json.filename), 'utf8', function (err, data) {
        if (err) throw err;
        w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
      });
    }
    else{
      // mongoose: connect if not connected
      mongoose.connection.readyState == 0 ?
        mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0
      // mongoose: if connected
      if(mongoose.connection.readyState == 1){
        FormData.find({appId: json.appId}).then(formdata=>{
          w_main ? w_main.webContents.send('form:getOne', formdata) : 0
        })
        .catch(err =>{
          console.log(err)
        })
      }
    }
  });
});

ipcMain.on('form:post', (e, doc)=>{
  var appId = doc.appId; delete doc.appId;
  doc['_id'] = makeId(8,'numbers');

  // get all filenames
  fs.readdir(path.join(__dirname, '_appdata'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
    // get target JSON Data
    let jsonData = files.reduce((temp, file, i)=>{
      let obj = fs.readFileSync(path.join(__dirname, '_appdata', file), {encoding: "utf8"});
      if(obj){
        if(JSON.parse(obj).appId == appId){
          temp = JSON.parse(obj);
          temp['filename'] = file;
        }
      }
      return temp;
    },{})

    // if JSON Data exists
    if(jsonData.appId){
      var filename = jsonData.filename; delete jsonData.filename;

      // check id
      while (jsonData.documents.filter( data => data._id == doc._id )[0]){
        doc['_id'] = makeId(8,'numbers')
      }

      // push to json
      jsonData.documents.push(doc)
    }
    else{
      var filename = `${appId}.json`;
      jsonData = { appId : appId, documents : [doc] };
    }

    fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(jsonData, null, 2), 'utf8', ()=>{

      require('dns').lookup('google.com',function(err) {
        if(con = err && err.code == "ENOTFOUND"){
          mongoose.connection.close()
        }
        else{
          // mongoose: connect if not connected
          mongoose.connection.readyState == 0 ?
            mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0

          // mongoose: if connected
          if(mongoose.connection.readyState == 1){
            mongoFormPost(doc, appId)
          }
        }
      });

    });

    w_main ? w_main.webContents.send('form:post') : 0

  })

});

function mongoFormPost(doc, appId){
  var documentId = doc._id; delete doc._id;

  new AppData(appId)(doc).save(function(err,newDoc){
    if (err) console.log(err);
    let {_id} = newDoc;

    fs.readdir(path.join(__dirname, '_appdata'), (err, files) => {
      // filter: JSON files
      files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )

      // update local file id
      let jsonData = files.reduce((temp, file, i)=>{
        let obj = fs.readFileSync(path.join(__dirname, '_appdata', file), {encoding: "utf8"});
        if(obj){
          if(JSON.parse(obj).appId == appId){
            temp = JSON.parse(obj);
            temp.documents.forEach( data => data._id == documentId ? data._id = _id : 0 )
            temp['filename'] = file;
          }
        }
        return temp;
      },{})

      let filename = jsonData.filename; delete jsonData.filename

      // write local
      fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(jsonData, null, 2), 'utf8', ()=>{});

    });

  })
}

// Menu ------------------------------------------------------------------------

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Quit',
        accelerator: process.platform == 'darwin' ? 'Command+W' : 'Ctrl+W',
        click(){
          app.quit()
        }
      }
    ]
  },
  {
    label: 'Dev Tools',
    submenu: [
      {
        label: 'Toggle Dev Tools',
        accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item, focusedWindow){
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: 'reload'
      }
    ]
  }
]
