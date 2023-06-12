const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require('sslcommerz-lts')

require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares----
app.use(cors());
app.use(express.json());
//----middlewares-----

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p9pdn5v.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox
const classCollection = client.db("photographyDB").collection("classes");
const selectClassCollection = client.db("photographyDB").collection("selected");
const instructorCollection = client
  .db("photographyDB")
  .collection("instructors");
const userCollection = client.db("photographyDB").collection("users");
const orderCollection = client.db("photographyDB").collection("orders");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role === "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // For homepage class section(limit to 6 and sorted)
    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // For homepage instructor section(limit to 6)
    app.get("/instructors", async (req, res) => {
      const result = await instructorCollection.find().limit(6).toArray();
      res.send(result);
    });
    // For instructors page
    app.get("/all_instructors", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });
    // TODO: no email, no query, no if
    // For classes page
    app.get("/all_classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    // Selected Classes post
    app.post("/select_classes", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    // Selected Classes
    // TODO: verifytJWT, decoded uncomment
    app.get("/select_classes", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const decodeEmail = req.decoded.email;
      if (email !== decodeEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email, paidStatus: false };
      const result = await selectClassCollection.find(query).toArray();
      res.send(result);
    });

    // my classes for instructors
    app.get("/my_classes", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const decodeEmail = req.decoded.email;
      if (email !== decodeEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // payment
    const tran_id = new ObjectId().toString()
    app.post('/orders', async(req, res)=>{
      
      const {classId, studentName, studentEmail, courseName, coursePrice, courseInstrunctor} = req.body;
      const data = {
        total_amount: coursePrice,
        currency: 'BDT',
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success/${tran_id}`,
        fail_url: 'http://localhost:3030/fail',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: studentName,
        cus_email: studentEmail,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    };
    console.log(data);
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
    sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({url:GatewayPageURL})
        const finalOrder = {courseName, studentEmail, studentName, paidStatus: false, courseInstrunctor, transectionId: tran_id}

        const result =  orderCollection.insertOne(finalOrder)
        console.log('Redirecting to: ', GatewayPageURL)
    });
// log: changed post to patch and ordercollection to selectedcollection
    app.post('/payment/success/:tranId', async(req,res)=>{
      const result = await orderCollection.updateOne({transectionId: req.params.tranId} ,{
      $set:{
        paidStatus: true,
      }
    })
    if(result.modifiedCount > 0){
      // log: created patch
     
      res.redirect(`http://localhost:5173/payment/success/${req.params.tranId}`)
    }
    })
    })

    // delete class for student dashboard
    app.delete("/select_classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectClassCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/enroll_classes', verifyJWT, async(req,res)=>{
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const decodeEmail = req.decoded.email;
      if (email !== decodeEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { studentEmail: email };
      const result = await orderCollection.find(query).toArray();
      console.log(result);
      console.log(result);
      res.send(result);
    })

    // Get all users
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Save new user data on server
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //  Is admin logged api
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Is instructor logged in
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    // Is student logged in
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    // make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // make instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Capture story server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
