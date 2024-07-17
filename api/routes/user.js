require('dotenv').config()
const express = require('express');
const router = express.Router();
const app = express();
const userSchema = require('../models/user');
const postSchema = require('../models/post');
const verify = require('../utils/verifyuser');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const storage = multer.memoryStorage();
const path = require('path');
const upload = multer({ storage: storage });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.post('/post', upload.single('image'), verify, async (req, res) => {
    const { post } = req.body;
    const { id } = req.user;

    try {
        const user = await userSchema.findById(id);
        if (!user) {
            req.flash('message', 'You are not authenticated!');
            return res.redirect('/home');
        }

        if (!req.file) {
            const userpost = new postSchema({
                userRef: user._id,
                username: user.email,
                post,
            });
            await userpost.save();
            res.redirect('/home');
            return;
        }

        // Handle file upload to Cloudinary
        const stream = cloudinary.uploader.upload_stream(
            { folder: "uploads" }, // Optional: Specify a folder
            async (error, result) => {
                if (error) {
                    console.error('Error uploading to Cloudinary:', error);
                    req.flash('message', 'Error uploading file. Please try again later.');
                    return res.redirect('/home');
                }

                // Create and save the new post
                const userpost = new postSchema({
                    userRef: user._id,
                    username: user.email,
                    post,
                    imgUrl: result.secure_url
                });

                const newpost = await userpost.save();
                req.flash('message', 'Posted successfully!');
                res.redirect('/home');
            }
        );

        stream.end(req.file.buffer);
    } catch (error) {
        console.error('Error in posting:', error);
        req.flash('message', 'Error in posting! Please try again later.');
        res.redirect('/home');
    }
});

router.post('/comment', verify, async (req, res) => {
    const { comment, postid } = req.body;
    const { id } = req.user;
    try {
        const userpost = await postSchema.findById(postid);
        const currentUser=await userSchema.findById(id);
        if (!userpost&&currentUser) {
            req.flash('message', 'Error posting comment!');
            return res.redirect('/home');
        }
        // console.log(currentUser.email);

       userpost.comment.push({ username:currentUser.email, text: comment });
        await userpost.save(); // Save the updated post document

        req.flash('message', 'Comment added successfully!');
        res.redirect('/home');
    } catch (error) {
        console.error('Error adding comment:', error);
        req.flash('message', 'Failed to add comment. Please try again later.');
        res.redirect('/home');
    }
});


module.exports = router;