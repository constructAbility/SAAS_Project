const express=require('express')

const router=express.Router();

const {register,verifyEmail,login }=require('../controllers/auth');



router.post('/register',register);
router.post('/login',login);
router.post('/verification/:token',verifyEmail);



module.exports=router