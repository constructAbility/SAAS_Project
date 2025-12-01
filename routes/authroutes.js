const express=require('express')

const router=express.Router();
const { ssoLogin } = require("../controllers/ssologin");
const {register,login  }=require('../controllers/auth');



router.post('/register',register);
router.post('/login',login);
router.post("/sso-login", ssoLogin);



module.exports=router
