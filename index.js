require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
let jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 9000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors({
  origin: ['http://localhost:5173','https://newfusion-f31a5.web.app','https://newfusion-f31a5.firebaseapp.com'],
  // credentials: true,
}));
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jo0u1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db('newsfusionDB').collection('users');

    const publisherCollection = client.db('newsfusionDB').collection('publishers');

    const articleCollection = client.db('newsfusionDB').collection('articles');

    const paymentCollection = client.db('newsfusionDB').collection('payments');




    // jwt related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    //middleware
    const verifyToken = (req, res, next) => {
      
      // console.log('insider verify token authorization', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorize access' })

      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
         return res.status(401).send({ message: 'unauthorize access' });

        }
        req.decoded = decoded;
          next()
     })
    
      

    }


    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    // admin related API
    app.get('/articles', verifyToken, verifyAdmin, async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page)
      // console.log(size,page);
      
      const result = await articleCollection.find().skip(page*size).limit(size).toArray();
      res.send(result);
    })
    app.post('/publisher',verifyToken,verifyAdmin, async (req, res) => {
      const publisherData = req.body;
      const result = await publisherCollection.insertOne(publisherData);
      res.send(result);
    })
    app.get('/homeArticles', async (req, res) => {
      const result = await articleCollection.find().toArray();
      res.send(result);
    })
    app.get('/users',verifyToken, async (req, res) => {
      const size = parseInt(req.query.size);
      const page=parseInt(req.query.page)
      // console.log('pagination query',size,page);
      const result = await userCollection.find().skip(page*size).limit(size).toArray();
      res.send(result)
    })
    app.get('/statistics', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.get('/usersCount', async (req, res) => {
      const count = await userCollection.estimatedDocumentCount();
      res.send({ count });
    })
    app.get('/articleCount', async (req, res) => {
      const count = await articleCollection.estimatedDocumentCount();
      res.send({ count });
    })
    app.get('/users/:email',verifyToken, async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({message:'forbidden access'})
      // }
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    })
    
    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.patch('/status/approve/:id',verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'approved'
        }
      }
      const result = await articleCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    app.patch('/articleUpdate/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const article = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: article.title,
          publisher: article.publisher,
          description: article.description,
          image: article.image,
          tags: article.tags,
          
        }
      }
      const result = await articleCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    app.put('/status/decline/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const {reason} = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {

          status: 'declined',
          reason: reason
        }
      }
      const result = await articleCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.delete('/status/delete/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/status/makePremium/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          isPremium: true
        }
      }
      const result = await articleCollection.updateOne(query, updatedDoc);
      res.send(result)
    })
    app.get('/singleUsers/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query)
      res.send(result)
    })
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin });
    })
    // users related API
    app.get('/users/update/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result)
    })
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email;
      const updateInfo = req.body;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          email: updateInfo?.email,
          name: updateInfo?.name,
          picPro:updateInfo?.picPro
        }

      }
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result)
    })
    app.get('/premiumArticles',verifyToken, async (req, res) => {
      const result = await articleCollection.find({isPremium:true}).toArray();
      res.send(result)
    })

    app.get('/myArticles/:email',verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({message:'forbidden access'})
      }
      const query = { 'author.email':email };
      const result = await articleCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/article/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.deleteOne(query);
      res.send(result);
    })

    app.put('/articles/view/:id',verifyToken,async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
       
      const updatedDoc = { $inc: { viewCount: 1 } }
      const result = await articleCollection.updateOne(query, updatedDoc);
      res.send(result)
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
     

      const userIsExist = await userCollection.findOne(query);

       if (userIsExist?.premiumTaken && Date.now() > userIsExist?.premiumTaken) {
         const updatedDoc = {
       $set:{premiumTaken: null}
     }
     await userCollection.updateOne(
       query,
       updatedDoc
      );
      // return res.status(200).json({ isPremium: false });
    }
      if (userIsExist) {
        return res.send({ message: 'user already exist ', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    app.get('/singleAdmin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result)
    })
    app.patch('/updateAdminData/:email', async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          name: data?.name,
          phone: data?.phone,
          photo: data?.photo,
          address: data?.address,
          
          
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result)
    })
    app.get('/articles/:id', async (req, res) => {
      const id = req.params.id;
     
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result)
    })

    app.get('/articles/update/:id', async (req, res) => {
      const id = req.params.id;
      //  console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    })

    app.put('/subscribe/:email', verifyToken,async (req, res) => {

      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({message:'forbidden access'})
      }

      const {duration} = req.body;
      const filter={email:email}
      const durationMapping = {
        '1-minute': 1 * 60 * 1000,
        '5-days': 5 * 24 * 60 * 60 * 1000,
        '10-days': 10 * 24 * 60 * 60 * 1000,
      };
      const expiryTime = Date.now() + (durationMapping[duration] || 0);
      const updatedDoc = {
        $set: {
          premiumTaken:expiryTime
        }
      }
      const result = await userCollection.updateOne(
      filter ,
       updatedDoc
      );
      res.send(result)
    })
    // Article related api
    app.get('/allArticle/approved', async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const tags = req.query.tags ? JSON.parse(req.query.tags) : [];
      // console.log(search);

      const query = {
        $and: [
          { status: 'approved' }, // Match only approved articles
          {
            title: {
              $regex: search,
              $options: 'i', // Case-insensitive search
            },
          },
        ],
      };

      if (tags.length > 0) {
        query.$and.push({
          'tags.value': { $in: tags }
        })
      }


      if (filter) { query.publisher = filter; }
      const approvedData = await articleCollection.find(query).toArray();
      res.send(approvedData)
    })
    app.get('/publisher', async (req, res) => {
      const result = await publisherCollection.find().toArray();

      res.send(result);
    })

    app.post('/articles', async (req, res) => {
      const article = req.body;
      // console.log(article);
      const user = await userCollection.findOne({ email: article.author.email });
       if (!user) {
      return res.status(404).send({ message: 'User not found' });
      }
      if (!user.premiumTaken) {
        const existingArticle = await articleCollection.findOne({ 'author.email': article.author.email });
        if (existingArticle) {
          return res.status(403).send({message:'Normal users can only add one article.'})
        }
      }
      const result = await articleCollection.insertOne(article);
      res.send(result);
    })

    app.get('/news/recent', async (req, res) => {
    try {
        const recentNews = await articleCollection.find().sort({ postedDate: -1 }).limit(10).toArray();
        res.send(recentNews);
    } catch (error) {
        res.status(500).send({ message: "Error fetching recent news", error });
    }
    });
    app.get('/recent/details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result)
    })

    // payment
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        payment_method_types: ['card'],
        currency: 'usd'
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result)
    })
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hot news is coming')
})
app.listen(port, () => {
  console.log('newsfusion is running on port:', port);
})