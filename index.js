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

var global = {
  _appdata: {
    syncing: 0
  }
}

function syncData(){
  // Form Data : One Way
  FormData.find().exec((err,m_formData)=>{
    if(m_formData){
      fs.readdir(path.join(__dirname, '_formdata'), (err, files) => {
        // filter: JSON files
        files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )

        // loop mlab data
        let matchResults = m_formData.reduce((m_temp, mlab)=>{
          mlab = mlab.toObject();
          mlab._id = mlab._id.toString();

          // loop local files
          let match = files.reduce((loc_temp, local_name)=>{
            try {
              let loc_formData = fs.readFileSync(path.join(__dirname, '_formdata', local_name), {encoding: "utf8"});
              if(loc_formData){
                // match appId
                let local = JSON.parse(loc_formData)
                if(local.appId == mlab.appId){
                  loc_temp = 1

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
    }

  });

  // App Data : Two Way
  if (global._appdata.syncing == 0){
    try{
      mongoose.connection.db.listCollections().toArray(function (err, collectionNames) {
        collections = collectionNames.reduce((temp, data)=>{
          data.name.length >= 24 ? temp.push(data.name) : 0 ;
          return temp;
        },[])

        syncAppData(collections)
      });
    }
    catch{
      console.log('unable to sync AppData')
    }
  }
  else{
    console.log('Appdata is currently syncing')
  }

}

function syncAppData(collections){
  var local_files;
  global._appdata.syncing = collections.length

  // read all local files
  fs.readdir(path.join(__dirname, '_appdata'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )

    local_files = files.reduce((temp, file)=>{
      try{
        let obj = JSON.parse(fs.readFileSync(path.join(__dirname, '_appdata', file), {encoding: "utf8"}))
        temp.push( { local: obj, filename: file } );
      }
      catch(err){}
      return temp
    },[])

  });

  // loop mlab collections
  collections.forEach((coll, coll_i)=>{
    AppData(coll).find().exec((err, mlab_docs)=>{
      if (mlab_docs){
        // if a local file's appId matches mlab document's appId
        let fileMatch = local_files.reduce((temp, data)=>{
          coll == data.local.appId ? temp.push(data) : 0
          return temp
        },[]);

        // remove __v from mlab docs
        mlab_docs = mlab_docs.reduce((temp, data)=>{
          data = data.toObject();
          delete data.__v
          temp.push(data)
          return temp
        },[])

        // when a file matches: compare documents
        if(fileMatch[0]){
          console.log('start')
          let {local, filename} = fileMatch[0]

          // loop mlab documents
          let matchResults = mlab_docs.reduce((m_temp, mlab)=>{
            // mlab = mlab.toObject();
            mlab._id = mlab._id.toString();

            // loop local documents
            let match = local.documents.reduce((loc_temp, loc_doc, i)=>{
              if(mlab._id == loc_doc._id){
                loc_temp = 1;

                // compare documents
                if(!_.isEqual(mlab, loc_doc)){
                  if(mlab._updated > loc_doc._updated || mlab._updated == loc_doc._updated){
                    // update local document
                    console.log('local sync')
                    local.documents.splice(i, 1, mlab)
                    fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(local, null, 2), 'utf8', (err)=>{
                      console.log('saved : update local doc')
                    });
                  }
                  else if(mlab._updated < loc_doc._updated){
                    // update mlab document
                    console.log('mlab sync')
                    mongoose.set('useFindAndModify', false);
                    AppData(coll).findOneAndUpdate({_id: loc_doc._id}, loc_doc, {upsert:true}, function(err, doc){
                      console.log('saved : update mlab doc')
                    });
                  }
                }
              }
              return loc_temp
            },0)

            // match evaluation
            match ? 0 : m_temp.push(mlab)
            return m_temp

          },[])

          // add new local documents
          matchResults.forEach((data)=>{
            local.documents.push(data);
          })
          matchResults[0] ?
            fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(local, null, 2), 'utf8', (err)=>{
              console.log('saved : add matchResults to local')
            }) : 0

          // add new mlab documents
          let newDocs = local.documents.reduce((temp, data)=>{
            if(data._newLocal){
              temp.push(data);
              delete data._newLocal;
            }
            return temp;
          },[])

          if(newDocs[0]){
            new Promise(function(resolve, reject){
              fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(local, null, 2), 'utf8', (err)=>{
                console.log('saved : remove newDocs _newLocal')
                resolve(1)
              })
            })
            .then((val)=>{
              let {length} = newDocs
              function saveDocs(i){
                let local_id = newDocs[i]._id
                delete newDocs[i]._id

                new AppData(coll)(newDocs[i]).save(function(err,newDoc){
                  let {_id} = newDoc

                  newDocs[i]._id = local_id

                  local.documents.forEach((data, index)=>{
                    if(data._id == local_id){
                      data._id = _id
                    }
                  })

                  ++i;
                  if(i == length){
                    fs.writeFile(path.join(__dirname, '_appdata', filename), JSON.stringify(local, null, 2), 'utf8', (err)=>{
                      console.log('saved : update newDocs Ids')
                      global._appdata.syncing != 0 ? --global._appdata.syncing : 0
                      console.log('minus : update newDocs Ids')
                      global._appdata.syncing == 0 ?
                        console.log(`global sync is empty`) : 0
                    })
                  }
                  else saveDocs(i)
                })
              }
              saveDocs(0)
            })
          }
          else{
            global._appdata.syncing != 0 ? --global._appdata.syncing : 0
            console.log('minus : no newDocs')
            global._appdata.syncing == 0 ?
              console.log(`global sync is empty`) : 0
          }

        }
        else{
          // add new local file/collection
          let newFile = { appId: coll, documents: mlab_docs }
          fs.writeFile(path.join(__dirname, '_appdata', `${coll}.json`), JSON.stringify(newFile, null, 2), 'utf8', (err)=>{
            global._appdata.syncing != 0 ? --global._appdata.syncing : 0
            console.log('minus : no fileMatch')
            global._appdata.syncing == 0 ?
              console.log(`global sync is empty`) : 0
          });
        }

      }

    })
  })

  // add new mlab collections

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

    // check connection
    require('dns').lookup('google.com',function(err) {
      if(con = err && err.code == "ENOTFOUND"){
        mongoose.connection.close()
        global._appdata.syncing = 0;
        w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: false}) : 0
      }
      else{
        w_main ? w_main.webContents.send('form:getAll', {files: files_doc, con: true}) : 0

        // check mongoose connection
        const con = async () => {
          mongoose.connection.readyState != 1 ?
            await mongoose.connect("mongodb://admin:pass0424@ds131784.mlab.com:31784/form-reader", {useNewUrlParser: true}) : 0
          if(mongoose.connection.readyState == 1) syncData()
          else{
            console.log('unable to connect : 2')
            global._appdata.syncing = 0;
          }
        }

        con().catch(err => {
          console.log('unable to connect : 1')
          global._appdata.syncing = 0;
        });
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

  try {
    // get selected JSON
    fs.readFile(path.join(__dirname, '_formdata', json.filename), 'utf8', function (err, data) {
      err ?
        w_main ? w_main.webContents.send('form:catch') : 0
        : w_main ? w_main.webContents.send('form:getOne', JSON.parse(data)) : 0
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
  doc['_newLocal'] = 1;

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
