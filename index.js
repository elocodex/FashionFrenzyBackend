require('dotenv').config();
const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const parser = require('body-parser');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

app.use(express.json());
app.use(cors());
app.use(parser.json())

// Database Connection MOngoDb
mongoose.connect("mongodb+srv://elocodex:eloeloelo*3@cluster0.1mtzakx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")

//Api Creation
app.get("/",(req,res)=>{
    res.send("Express App Is Running")
})

// AWS S3 Configuration
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Image storage engine
const storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
        cb(null, `${Date.now().toString()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({storage:storage})
// Creating Upload Enpoint for Image upload
app.use('/images', express.static('upload/images'))
app.post("/upload", upload.single('product'),(req,res)=>{
    try {
        if (!req.file) {
            console.log("Unfortunately, no file uploaded")
            return res.status(400).send("No file uploaded.");
        }
        res.json({
            success: 1,
            imageUrl: req.file.location
        })
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: 0, message: 'Server error' });
    }
});

// Creating User Schema for creating product in database
const Product = mongoose.model("Product", {
    id:{
        type: Number,
        required: true
    },
    name:{
        type: String,
        required:true
    },
    image:{
        type: String,
        required:true
    },
    category:{
        type:String,
        required:true
    },
    new_price:{
        type:Number,
        required:true
    },
    old_price:{
        type:Number,
        required:true
    },
    date:{
        type:Date,
        default:Date.now
    },
    available:{
        type:Boolean,
        default:true
    }
})

app.post('/addproduct',async (req,res)=>{
    let products = await Product.find({})
    let id;
    if(products.length > 0){
        let last_Product_array = products.slice(-1)
        let last_product = last_Product_array[0]
        id = last_product.id + 1
    }else{
        id = 1;
    }
    try {
        const product = new Product({
            id: id,
            name:req.body.name,
            image:req.body.image,
            category:req.body.category,
            new_price:req.body.new_price,
            old_price:req.body.old_price
        })
        await product.save();
        console.log(product);
        console.log("Saved");
        res.json({
            success:1,
            name:req.body.name
        })
    } catch (e) {
        console.log(e.message);
        console.log("request: "+req.body.name);
    }
})
// Creating Api for deleting products
app.post('/removeproduct', async (req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log('removed');
    res.json({
        success:true,
        name:req.body.name
    })
})


// Creating api for getting all products
app.get('/allproduct', async (req,res)=>{
    let products = await Product.find({})
    console.log("All Products Fetched");
    res.send(products)
})

// Card Schema
const CardSchema = mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    cardNumber:{
        type:String,
        required:true
    },
    cvv:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    month:{
        type:String,
        required:true
    },
    year:{
        type:String,
        required:true
    },
    contact:{
        type:String,
        required:true
    },
    address:{
        type:String,
        required:true
    }
})

const Cards = mongoose.model('Cards', CardSchema)


// Users Schema
const Users = mongoose.model('Users',{
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String
    },
    cartData:{
        type:Object
    },
    date:{
        type:Date,
        default:Date.now
    },
    card: [ CardSchema ]
})


// Endpoint for user Creation
app.post('/signup',async(req,res)=>{
    let check = await Users.findOne({email:req.body.email})
    if(check){
        return res.status(400).json({success:false,error:'Existing User found with same Email Id'})
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0
    }

    const user = new Users({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData: cart,
    })
    await user.save()

    // JWT Authentication
    const data = {
        user:{
            id:user.id
        }
        // creating token
    }
    const token = jwt.sign(data,'secret_ecom')
    res.json({success:true,token,user})
})

// Endpoint for User login
app.post('/login', async (req,res)=>{
    let user = await Users.findOne({email:req.body.email})
    console.log(user);
    // let username = user.name
    // console.log(username);
    if(user){
        const passCompare = req.body.password === user.password
        if(passCompare){
            const data = {
                user:{
                    id: user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom')
            res.json({success:true,user,token})
        }else{
            res.json({
                success:false,
                error:"Wrong Password",
            })
        }
    }else{
        res.json({succes:false,error:"Wrong Email Id"})
    }
})

// new Collections Endpoint
app.get('/newcollections',async (req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("newcollection fetched");
    res.send(newcollection)
})

// Popular In women Endpoint
app.get('/popularinwomen', async(req,res)=>{
    let products = await Product.find({category:"women"})
    let popularinwomen = products.slice(0,4);
    console.log('Popular in Women Fetched');
    res.send(popularinwomen)
})

app.get('/popularinmen', async(req,res)=>{
    let products = await Product.find({category:"men"})
    let popularinmen = products.slice(0,4);
    console.log('Popular in Men Fetched');
    res.send(popularinmen)
})

app.get('/popularinkids', async(req,res)=>{
    let products = await Product.find({category:"kid"})
    let popularinkid = products.slice(0,4);
    console.log('Popular in kids Fetched');
    res.send(popularinkid)
})

// Middleware to fetch user

const fetchUser = async(req,res,next)=>{
    const token = req.header('auth-token')
    if(!token){
        res.status(401).send({errors:"Please Authenticate using valid Token"})
    }else{
        try {
            const data = jwt.verify(token,'secret_ecom')
            req.user = data.user
            next();
        } catch (e) {
            res.status(401).send({error:"Authenticate Using a valid Token"})
        }
    }
}

// username endpoint
app.get('/getusername',fetchUser,async(req,res)=>{
    let userData = await Users.findOne({_id:req.user.id})
    // console.log(userData.name);
    res.send(userData.name)
})

// Adding Products in cartData Endpoint
app.post('/addtocart', fetchUser, async(req,res)=>{
    console.log(req.body,req.user);
    console.log("Added",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id})
    userData.cartData[req.body.itemId] += 1 ;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})

    res.send("Added")
})

// remove products in CartData Endpoint
app.post('/removefromcart', fetchUser , async(req,res)=>{
    console.log("removed",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id})
    if(userData.cartData[req.body.itemId] > 0){
        userData.cartData[req.body.itemId] -= 1 ;
        await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
        res.send("Removed")
    }
})

// Getting Cart Data Endpoint
app.post('/getcart',fetchUser, async(req,res)=>{
    console.log("Getcart");
    let userData = await Users.findOne({_id:req.user.id})
    res.json(userData.cartData)
})


// Endpoint for Card Details
app.post('/card',fetchUser, async (req,res)=>{
    try {
        const card = new Cards({
            name:req.body.name,
            cardNumber:req.body.cardNumber,
            cvv:req.body.cvv,
            email:req.body.email,
            month:req.body.month,
            year:req.body.year,
            contact:req.body.contact,
            address:req.body.address,
        })
        console.log(card,card._id);
        await Users.findOneAndUpdate({_id:req.user.id},{card:card})
        res.json({success:true,message:"Card Details Updated Successfully!" ,cardDets:card})
        console.log("Card Update Successful");
    } catch (e) {
        res.json({success:false,message:"Card Details not Updated !"})
        console.log("Card Update Failed");
    }
} )

// Endpoint for Getting Card Details
app.post('/getcarddetails',fetchUser, async(req,res)=>{
    try {
        let cardData = await Users.findOne({_id:req.user.id})
        let card = cardData.card
        console.log(card);
        res.json({success:true, card })
    } catch (e) {
        console.log(e);
        res.json({success:false})
    }
})

// Endpoint for Deleting Card Details
app.post('/deletecarddetails',fetchUser, async(req,res)=>{
    console.log(await Users.findOneAndUpdate({_id:req.user.id},{card:[]}));
    try {
        await Users.findOneAndUpdate({_id:req.user.id},{card:[]})
        res.json({success:true,message:"Card Deleted Successfully"})
        console.log("Card Deleted");
    } catch (e) {
        console.log(e);
        res.json({success:false,message:"Card Deletion Failed"})
        console.log("Card Deletion Failed");
    }
})



app.listen(port,'0.0.0.0', (error)=>{
    if(!error){
        console.log("Server Running on Port" + port);
    }else{
        console.log("Error : " + error);
    }
})
