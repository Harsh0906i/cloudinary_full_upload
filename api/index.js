const express = require('express');
const path = require('path');
const app = express();
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const flash = require('express-flash');
const session = require('express-session');
const authrouter = require('./routes/auth');
const userpost = require('./routes/user');
const postSchema = require('./models/post');
const cookie = require('cookie-parser');
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
}));

app.use(flash());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Use path.join for views directory

app.use(cookie());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/auth', authrouter);
app.use('/api/post', userpost);
main()
    .then(() => {
        console.log("connected to DB");
    }).catch((err) => {
        console.log(err);
    });
async function main() {
    await mongoose.connect(process.env.MONGOURI);
};

app.get('/', (req, res) => {
    res.render('signup', { message: req.flash('message') });
});

app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('message') });
});

app.get('/home', async (req, res) => {
    const posts = await postSchema.find();
    res.render('home', { message: req.flash('message'), posts });
});

app.get('/reset-password', (req, res) => {
    res.render('resetpass', { token: req.query.token })
});
app.post('/update', async (req, res) => {
    const { postupdate } = req.body;
    const post = await postSchema.findById(postupdate);
    res.render('update', { post });
})

app.get('/forgetpassword', (req, res) => {
    res.render('forgetpass', { message: req.flash('message') });
});

app.listen('8080', () => {
    console.log('listening on 8080')
});