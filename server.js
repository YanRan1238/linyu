const express = require('express');
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// ========== 账号配置 ==========
const USER_LIST = {
  "霖鱼july": { password: "88888", role:"admin" },
  "小霖石": { password: "123", role:"guest" }
};
const JWT_SECRET = "linyu-secret-2026";

// 静态资源目录
app.use(express.static(path.join(__dirname,'public')));
app.use(express.json());

// 存储目录
const UPLOAD_DIR = path.join(__dirname,'uploads');
if(!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// multer 文件上传
const storage = multer.diskStorage({
  destination:function(req,file,cb){
    cb(null,UPLOAD_DIR);
  },
  filename:function(req,file,cb){
    const ext = path.extname(file.originalname);
    const name = Date.now()+ext;
    cb(null,name);
  }
});
const upload = multer({storage});

//持久化配置文件
const CONFIG_FILE = path.join(__dirname,'config.json');
let appConfig = {
  bgUrl:"",
  videoBgUrl:"",
  content:"欢迎使用霖鱼July歌单系统\n歌曲A\n歌曲B\n歌曲C"
};
//读取本地配置
if(fs.existsSync(CONFIG_FILE)){
  const raw = fs.readFileSync(CONFIG_FILE,'utf8');
  appConfig = JSON.parse(raw);
}
function saveConfigFile(){
  fs.writeFileSync(CONFIG_FILE,JSON.stringify(appConfig,null,2),'utf8');
}

// ========== 登录接口（返回role！适配你的前端） ==========
app.post("/api/login", (req,res)=>{
  const {username, password} = req.body;
  if(!USER_LIST[username]){
    return res.json({ok:false,msg:"账号不存在"});
  }
  if(USER_LIST[username].password !== password){
    return res.json({ok:false,msg:"密码错误"});
  }
  //生成token，把角色放进token
  const token = jwt.sign({user:username, role:USER_LIST[username].role}, JWT_SECRET, {expiresIn:"24h"});
  res.json({ok:true, token, role: USER_LIST[username].role});
});

// ========== 新增：前端需要的checkToken接口 ==========
app.get("/api/checkToken", (req,res)=>{
  const auth = req.headers.authorization;
  if(!auth || !auth.startsWith("Bearer ")){
    return res.json({ok:false});
  }
  const token = auth.slice(7);
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ok:true, role:payload.role});
  }catch(e){
    res.json({ok:false});
  }
});

// ========== 校验token中间件（管理接口必须携带token） ==========
function checkLogin(req,res,next){
  const auth = req.headers.authorization;
  if(!auth || !auth.startsWith("Bearer ")){
    return res.status(401).json({ok:false,msg:"请先登录"});
  }
  const token = auth.slice(7);
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.userInfo = payload;
    next();
  }catch(e){
    return res.status(401).json({ok:false,msg:"登录失效，请重新登录"});
  }
}

// ========== 查看歌单：任何人可以访问，不用登录 ==========
app.get('/api/getConfig',(req,res)=>{
  res.json(appConfig);
});

// ========== 修改上传接口【登录校验】 ==========
app.post('/api/uploadBg', checkLogin, upload.single('bgImage'),(req,res)=>{
  if(!req.file){
    return res.json({ok:false,msg:"没有选择文件"});
  }
  const bgUrl = `/uploads/${req.file.filename}`;
  appConfig.bgUrl = bgUrl;
  appConfig.videoBgUrl = "";
  saveConfigFile();
  res.json({ok:true,bgUrl});
});
app.post('/api/uploadVideoBg', checkLogin, upload.single('bgVideo'),(req,res)=>{
  if(!req.file){
    return res.json({ok:false,msg:"没有选择文件"});
  }
  const videoBgUrl = `/uploads/${req.file.filename}`;
  appConfig.videoBgUrl = videoBgUrl;
  appConfig.bgUrl = "";
  saveConfigFile();
  res.json({ok:true,videoBgUrl});
});
app.post('/api/clearBg', checkLogin, (req,res)=>{
  appConfig.bgUrl = "";
  appConfig.videoBgUrl = "";
  saveConfigFile();
  res.json({ok:true});
});
app.post('/api/saveContent', checkLogin, (req,res)=>{
  const {content} = req.body;
  appConfig.content = content || "";
  saveConfigFile();
  res.json({ok:true});
});

//提供uploads静态访问
app.use('/uploads',express.static(UPLOAD_DIR));

app.listen(PORT, ()=>{
  console.log(`服务运行 http://127.0.0.1:${PORT}`)
});
