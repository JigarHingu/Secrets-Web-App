require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const MongoStore = require("connect-mongo");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Create a new instance of MongoStore
const store = MongoStore.create({mongoUrl: process.env.MONGO_URL});
app.use(
  session({
    secret: "Kyaa Farkk Padtaa Hai.",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URL);

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB successfully!");
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id)
    .then(user => {
      if (!user) {
        throw new Error('User not found');
      }
      done(null, user);
    })
    .catch(err => {
      console.error(err);
      done(err, null);
    });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL:"https://secrets-web-app-wt4j.onrender.com/auth/google/secrets",
      // (for run this code locally us this callvackURL:http://localhost:3000/auth/google/secrets", )
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
}


app.get("/", function (req, res) {
  res.render("home");
});


app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", ensureAuthenticated, function (req, res) {
  User.find({ secret: { $ne: null } })
  .then(foundUsers => {
    res.render("secrets", { usersWithSecrets: foundUsers });
  })
  .catch(err => {
    console.log(err);
    res.render("error", { message: "An error occurred." });
  });
});

app.get("/submit", ensureAuthenticated, function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function (req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id)
  .then(foundUser => {
    if (foundUser) {
      foundUser.secret = submittedSecret;
      return foundUser.save();
    } else {
      throw new Error('User not found');
    }
  })
  .then(() => {
    res.redirect("/secrets");
  })
  .catch(err => {
    console.log(err);
    res.render("error", { message: "An error occurred." });
  });
});

app.get("/logout", function (req, res) {
  req.logout(function(err){
    if(err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.render("error", { message: "An error occurred." });
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
      res.render("error", { message: "An error occurred." });
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/about", function (req, res) {
  res.render("about");
});

app.get("/welcome", function (req, res) {
  res.render("welcome");
});

app.listen(PORT, function () {
  console.log(`Server running on http://localhost:${PORT}`);
});

