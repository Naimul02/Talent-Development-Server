const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
// {
//   origin: ["http://localhost:5173" , "https://assignment-12-a6ad4.web.app/"],
// }
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.avssyq6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const classesCollection = client.db("assignment-12").collection("classes");
    const usersCollection = client.db("assignment-12").collection("users");
    const teachOnCollection = client.db("assignment-12").collection("teachOn");
    const paymentCollection = client.db("assignment-12").collection("payment");
    const feedbackCollection = client
      .db("assignment-12")
      .collection("feedback");
    const assignmentCollection = client
      .db("assignment-12")
      .collection("assignment");
    const assignmentSubmitCollection = client
      .db("assignment-12")
      .collection("assignmentSubmit");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log("EMAIL ", email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        console.log("you are not admin");
        res.status(401).send({ message: "forbidden access" });
      }
      next();
    };
    // pagination
    app.get("/classesCount", async (req, res) => {
      const classFilter = await classesCollection.find().toArray();
      const filter = classFilter.filter(
        (singleClass) => singleClass.status === "accepted"
      );

      const count = filter.length;
      res.send({ count });
    });
    app.get("/teacherRequestCount", async (req, res) => {
      const teachersFilter = await teachOnCollection.find().toArray();
      const count = teachersFilter?.length;
      res.send({ count });
    });
    app.get("/usersCount", async (req, res) => {
      const usersCount = await usersCollection.find().toArray();
      const count = usersCount?.length;
      res.send({ count });
    });

    // users
    app.get("/users", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      console.log("pagination query", page, size);

      const result = await usersCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const info = req.body;
      const result = await usersCollection.insertOne(info);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      console.log("pagination query", page, size);
      const result = await classesCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    app.get("/class/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });
    // verifyToken, verifyAdmin,
    app.get("/teachOn", verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      console.log("pagination query", page, size);

      const result = await teachOnCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    // teach on :id
    app.get("/teachOn/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await teachOnCollection.findOne(query);
      // console.log("ottoi result ", result);
      res.send(result);
    });
    // teachOn
    app.post("/teachOn", async (req, res) => {
      const info = req.body;

      const result = await teachOnCollection.insertOne(info);
      res.send(result);
    });
    // approved
    app.patch("/teachOn/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "accepted",
        },
      };
      const result = await teachOnCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // rejected
    app.patch(
      "/teachOnRejected/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await teachOnCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // assignmentSubmit
    app.post("/assignmentSubmit", async (req, res) => {
      const info = req.body;
      const result = await assignmentSubmitCollection.insertOne(info);
      res.send(result);
    });

    // submit
    app.get("/assignmentSubmit/:title", async (req, res) => {
      const title = req.params.title;
      console.log("title", title);
      const query = { title: title };
      const result = await assignmentSubmitCollection.find(query).toArray();
      console.log("result", result);
      res.send(result);
    });
    // feedback
    app.post("/users/feedback", async (req, res) => {
      const info = req.body;
      const result = await feedbackCollection.insertOne(info);
      res.send(result);
    });
    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      // console.log("result ", result);
      res.send(result);
    });
    // enrol update
    app.patch("/enrollUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const singleClass = await classesCollection.findOne(filter);
      const enroll = parseInt(singleClass.total_enrolment);
      const newEnroll = enroll ? enroll + 1 : 0 + 1;
      console.log("koire tora", enroll, newEnroll);

      const updatedDoc = {
        $set: {
          total_enrolment: newEnroll,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // dashboard

    app.get("/my-enroll/:title", async (req, res) => {
      const title = req.params.title;
      const query = {title };
      const result = await paymentCollection.findOne(query);
      res.send(result);
    });

    // teacher related api
    app.post("/users/assignment", async (req, res) => {
      const info = req.body;
      const result = await assignmentCollection.insertOne(info);
      res.send(result);
    });
    // title
    app.get("/users/assignment/:title", async (req, res) => {
      const title = req.params.title;

      const query = { title };
      const result = await assignmentCollection.find(query).toArray();
      console.log("ottoi : ", result);
      res.send(result);
    });

    // add class
    app.post("/addClass", async (req, res) => {
      const info = req.body;
      const result = await classesCollection.insertOne(info);
      res.send(result);
    });
    app.get("/users/teacher/:email", async (req, res) => {
      const email = req.params.email;
      console.log("teacher" , email)
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let teacher = false;
      if (user) {
        teacher = user?.role === "teacher";
      }
      res.send({ teacher });
    });

    app.get("/totalEnrolAssign/:title/:id", async (req, res) => {
      const title = req.params.title;
      const id = req.params.id;
      const query = { title };
      console.log(title, id);
      const findOut = { _id: new ObjectId(id) };
      const totalAssignment = await assignmentCollection.find(query).toArray();
      const totalSubmitAssignment = await assignmentSubmitCollection
        .find(query)
        .toArray();
      const totalEnrolment = await classesCollection.findOne(findOut);
      res.send({ totalAssignment, totalEnrolment, totalSubmitAssignment });
    });

    app.get("/users/teacherClasses/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/users/teacherClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(filter);
      res.send(result);
    });
    app.get("/users/teacherClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(filter);
      res.send(result);
    });

    app.patch("/updateClass/:id", async (req, res) => {
      const info = req.body;
      // console.log("info", info);
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: info.name,
          email: info.email,
          title: info.title,
          price: info.price,
          image: info.image,
          short_description: info.short_description,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // admin related api
    app.get("/users/admin/feedback/:classTitle", async (req, res) => {
      const classTitle = req.params.classTitle;
      console.log(classTitle);
      const query = { classTitle: classTitle };
      const result = await feedbackCollection.find(query).toArray();
      console.log("feedback", result);
      res.send(result);
    });
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/admin/classes/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "accepted",
          },
        };
        const result = await classesCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/admin/classes/Rejected/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await classesCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello developer");
});

app.listen(port, () => {
  console.log(`the port is running on ${port}`);
});
