const
  electron = require('electron'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  {app, BrowserWindow, Menu, ipcMain} = electron,
  mongoose = require("mongoose"),
  makeId = require('./modules/makeId');

mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true});

// Models
let FormData = require("./models/formdata");
let Dynamic = require("./models/dynamic");

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

ipcMain.on('form:getAll', (e)=>{

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND"){
      // get all filenames
      fs.readdir(path.join(__dirname, 'json'), (err, files) => {
        // filter: JSON files
        files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
        // get JSON properties
        let files_doc = files.reduce((temp, file, i)=>{
          let data = fs.readFileSync(path.join(__dirname, 'json', file), {encoding: "utf8"});
          if(JSON.parse(data)._app){
            let { appId, caption } = JSON.parse(data)._app;
            temp.push({ appId: appId, caption: caption, filename: file });
          }
          return temp;
        },[])
        // send to view
        w_main ? w_main.webContents.send('form:getAll', files_doc) : 0
      })
    }
    else{
      FormData.find({}, (err, formdata)=>{
        if(formdata){
          let files_doc = formdata.reduce((temp, data, i)=>{
            let {appId, caption} = data._app
            temp.push({ appId: appId, caption : caption, filename : null })
            return temp;
          },[])
          w_main ? w_main.webContents.send('form:getAll', files_doc) : 0
        }
        else{
          w_main ? w_main.webContents.send('form:empty') : 0
        }
      })
    }
  })



})

ipcMain.on('form:getInitial', (e)=>{

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND"){
      // get all filenames
      fs.readdir(path.join(__dirname, 'json'), (err, files) => {
        // filter: JSON files
        files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
        // get first JSON
        if(files[0]){
          fs.readFile(path.join(__dirname, 'json', files[0]), 'utf8', function (err, data) {
            if (err) throw err;
            // send to view
            w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
          });
        }
        else{
          w_main ? w_main.webContents.send('form:empty') : 0
        }
      })
    }
    else{
      FormData.find({}, (err, formdata)=>{
        w_main ?
          formdata[0] ?
            w_main.webContents.send('form:getOne', formdata) :
            w_main.webContents.send('form:empty')
          : 0
      });

    }
  });
})

ipcMain.on('form:getOne', (e, json)=>{

  require('dns').lookup('google.com',function(err) {
    if(con = err && err.code == "ENOTFOUND" && json.filename){
      // get selected JSON
      fs.readFile(path.join(__dirname, 'json', json.filename), 'utf8', function (err, data) {
        if (err) throw err;
        // send to view
        w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
      });
    }
    else{
      FormData.find({appId: json.appId}, (err, formdata)=>{
        w_main ? w_main.webContents.send('form:getOne', formdata) : 0
      });
    }
  })


})

ipcMain.on('form:post', (e, doc)=>{
  doc['id'] = makeId(8,'numbers')

  // get all filenames
  fs.readdir(path.join(__dirname, 'jsonData'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
    // get target JSON Data
    let jsonData = files.reduce((temp, file, i)=>{
      let obj = fs.readFileSync(path.join(__dirname, 'jsonData', file), {encoding: "utf8"});
      if(JSON.parse(obj)){
        let appId = JSON.parse(obj).appId
        if(appId == doc.appId){
          temp = JSON.parse(obj);
          temp['filename'] = file
        }
      }
      return temp;
    },{})

    // if JSON Data exists
    if(jsonData.appId){
      let filename = jsonData.filename
      delete jsonData.filename
      delete doc.appId

      // check id
      while (jsonData.documents.filter( data => data.id == doc.id )[0]){
        doc['id'] = makeId(8,'numbers')
      }

      // push to json
      jsonData.documents.push(doc)

      fs.writeFile(path.join(__dirname, 'jsonData', filename), JSON.stringify(jsonData, null, 2), 'utf8', function(){
        console.log('saved')
      });
    }
    else{
      let appId = doc.appId
      delete doc.appId
      let jsonData = {
        appId : appId,
        documents : [doc]
      }

      fs.writeFile(path.join(__dirname, 'jsonData', `${appId}.json`), JSON.stringify(jsonData, null, 2), 'utf8', function(){
        console.log('saved')
      });
    }

    // w_main.reload()
    w_main ? w_main.webContents.send('form:post') : 0


  })

  // new Dynamic(doc.appId)({name: 'Jon'}).save(err => {
  //   console.log(err);
  //   w_main ? w_main.webContents.send('form:post') : 0
  // })

})



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
