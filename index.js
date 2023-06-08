const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;

// middlewares----
app.use(cors())
app.use(express.json())
//----middlewares-----




const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p9pdn5v.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const classCollection = client.db('photographyDB').collection('classes')
const instructorCollection = client.db('photographyDB').collection('instructors')

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // For homepage class section(limit to 6 and sorted)
    app.get('/classes', async(req,res)=>{
        const result = await classCollection.find().sort({enrolledStudents: -1}).limit(6).toArray()
        res.send(result)
    })

    // For homepage instructor section(limit to 6)
    app.get('/instructors', async(req, res)=>{
        const result = await instructorCollection.find().limit(6).toArray()
        res.send(result)
    })
    // For instructors page 
    app.get('/allinstructors', async(req, res)=>{
        const result = await instructorCollection.find().toArray()
        res.send()
    })
    // For classes page
    app.get('/allclasses', async(req, res)=>{
        const result = await instructorCollection.find().toArray()
        res.send()
    })

    




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('Capture story server is running')
})

app.listen(port, () =>{
    console.log(`Server is running on port: ${port}`)
})
