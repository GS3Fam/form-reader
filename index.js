const
  electron = require('electron'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  {app, BrowserWindow, Menu, ipcMain} = electron;

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

ipcMain.on('json:getAll', (e)=>{
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
    w_main.webContents.send('json:getAll', files_doc)
  })
})

ipcMain.on('json:getInitial', (e)=>{
  // get all filenames
  fs.readdir(path.join(__dirname, 'json'), (err, files) => {
    // filter: JSON files
    files = files.filter( file => file.split('.')[file.split('.').length-1] == 'json' )
    // get first JSON
    if(files[0]){
      fs.readFile(path.join(__dirname, 'json', files[0]), 'utf8', function (err, data) {
        if (err) throw err;
        // send to view
        w_main.webContents.send('json:getOne', JSON.parse(data))
      });
    }
    else{
      w_main.webContents.send('json:empty')
    }
  })
})

ipcMain.on('json:getOne', (e, json)=>{
  // get selected JSON
  fs.readFile(path.join(__dirname, 'json', json), 'utf8', function (err, data) {
    if (err) throw err;
    // send to view
    w_main.webContents.send('json:getOne', JSON.parse(data))
  });
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
