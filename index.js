const
  electron = require('electron'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  {app, BrowserWindow, Menu, ipcMain} = electron,
  mongoose = require("mongoose"),
  makeId = require('./modules/makeId'),
  _ = require('lodash');

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
  // Form Data : One Way
  FormData.find().exec((err,m_formData)=>{
    fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
      // filter: JSON files
      files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )

      // loop m_formData
      let matchResults = m_formData.reduce((m_temp, mlab)=>{
        mlab = mlab.toObject();
        // loop local files
        let match = files.reduce((loc_temp, local_name)=>{
          try {
            let loc_formData = fs.readFileSync(path.join(__dirname, '_formdata', local_name), {encoding: "utf8"});
            if(loc_formData){
              // match appId
              let local = JSON.parse(loc_formData)
              if(local.appId == mlab.appId){
                loc_temp = 1
                mlab._id = mlab._id.toString()

                // compare json
                if(!_.isEqual(mlab, local)){
                  fs.writeFile(path.join(__dirname, '_formdata', local_name), JSON.stringify(mlab, null, 2), 'utf8', ()=>{});
                }

              }
            }
          }
          catch(err){
            console.log('file error')
          }

          return loc_temp
        },0)

        // match evaluation
        match ? 0 : m_temp.push(mlab)
        return m_temp

      },[])

      // write new forms to local
      matchResults.forEach((data)=>{
        fs.writeFile(path.join(__dirname, '_formdata', `${data.appId}.json`), JSON.stringify(data, null, 2), 'utf8', ()=>{});
      })

    });

  })

  console.log('synced')
}
function sortCaptions(a,b) {
  if (a.caption < b.caption) return -1;
  if (a.caption > b.caption) return 1;
  return 0;
}

ipcMain.on('form:getAll', (e)=>{
  // console.log(mongoose.connection.readyState)

  // get all filenames
  fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
    // get JSON properties
    let files_doc = files.reduce((temp, file, i)=>{
      try{
        let data = fs.readFileSync(path.join(__dirname, '_formdata', file), {encoding: "utf8"});
        if(JSON.parse(data)._app){
          let { appId, caption } = JSON.parse(data)._app;
          temp.push({ appId: appId, caption: caption, filename: file });
        }
      }
      catch(err){
        console.log('file error')
      }
      return temp;
    },[])

    // sort files by caption
    files_doc.sort(sortCaptions);

    require('dns').lookup('google.com',function(err) {
      if(con = err && err.code == "ENOTFOUND"){
        mongoose.connection.close()
        w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: false}) : 0
      }
      else{
        w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: true}) : 0
        // mongoose: connect if not connected
        mongoose.connection.readyState == 0 ?
          mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0
        // mongoose: if connected
        if(mongoose.connection.readyState == 1){
          syncData();
        }
      }

    });

  })

});

ipcMain.on('form:getInitial', (e)=>{

  // get all filenames
  fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )

    let files_doc = files.reduce((temp, file, i)=>{
      try{
        let data = fs.readFileSync(path.join(__dirname, '_formdata', file), {encoding: "utf8"});
        if(JSON.parse(data)._app){
          let { appId, caption } = JSON.parse(data)._app;
          temp.push({ appId: appId, caption: caption, filename: file });
        }
      }
      catch(err){
        console.log('file error')
      }
      return temp;
    },[])

    // sort files by caption
    files_doc.sort(sortCaptions);

    // get first JSON
    if(files_doc[0]){
      fs.readFile(path.join(__dirname, '_formdata', files_doc[0].filename), 'utf8', function (err, data) {
        if (err) throw err;
        w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
      });
    }
    else{
      w_main ? w_main.webContents.send('form:empty') : 0
    }
  })

});

ipcMain.on('form:getOne', (e, json)=>{

  mongoose.connection.close()
  try {
    // get selected JSON
    fs.readFile(path.join(__dirname, '_formdata', json.filename), 'utf8', function (err, data) {
      if (err) throw err;
      w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
    });
  }
  catch(err){
    console.log('file error')
  }

});

ipcMain.on('form:post', (e, doc)=>{
  var appId = doc.appId; delete doc.appId;
  doc['_id'] = makeId(8,'numbers');
  doc['_updated'] = Date();

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

    fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(jsonData, null, 2), 'utf8', ()=>{});

    w_main ? w_main.webContents.send('form:post') : 0

  })

});

function mongoFormPost(doc, appId){
  // var documentId = doc._id; delete doc._id;
  //
  // new AppData(appId)(doc).save(function(err,newDoc){
  //   if (err) console.log(err);
  //   let {_id} = newDoc;
  //
  //   fs.readdir(path.join(__dirname, '_appdata'), (err, files) => {
  //     // filter: JSON files
  //     files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
  //
  //     // update local file id
  //     let jsonData = files.reduce((temp, file, i)=>{
  //       let obj = fs.readFileSync(path.join(__dirname, '_appdata', file), {encoding: "utf8"});
  //       if(obj){
  //         if(JSON.parse(obj).appId == appId){
  //           temp = JSON.parse(obj);
  //           temp.documents.forEach( data => data._id == documentId ? data._id = _id : 0 )
  //           temp['filename'] = file;
  //         }
  //       }
  //       return temp;
  //     },{})
  //
  //     let filename = jsonData.filename; delete jsonData.filename
  //
  //     // write local
  //     fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(jsonData, null, 2), 'utf8', ()=>{});
  //
  //   });
  //
  // })
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
