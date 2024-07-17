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
        const currentUser = await userSchema.findById(id);
        if (!userpost && currentUser) {
            req.flash('message', 'Error posting comment!');
            return res.redirect('/home');
        }
        userpost.comment.push({ username: currentUser.email, text: comment, userRef: id });
        await userpost.save(); // Save the updated post document

        req.flash('message', 'Comment added successfully!');
        res.redirect('/home');
    } catch (error) {
        console.error('Error adding comment:', error);
        req.flash('message', 'Failed to add comment. Please try again later.');
        res.redirect('/home');
    }
});

router.post('/commentdelete', verify, async (req, res) => {
    try {
        const { postid, deletecomment } = req.body;
        const { id: userId } = req.user;

        // Find the post by postid
        const post = await postSchema.findById(postid);
        if (!post) {
            req.flash('message', 'Post not found');
            return res.redirect('/home');
        }

        // Find the comment by deletecomment within the post
        const comment = post.comment.id(deletecomment);
        if (!comment) {
            req.flash('message', 'Comment not found');
            return res.redirect('/home');
        }

        // Check if the user is authorized to delete the comment
        if (comment.userRef !== userId) {
            req.flash('message', 'You are not authorized to delete this comment');
            return res.redirect('/home');
        }

        // Pull the comment
        const updatedPost = await postSchema.findByIdAndUpdate(
            postid,
            { $pull: { comment: { _id: deletecomment } } },
            { new: true }
        );

        req.flash('message', updatedPost ? 'Comment deleted successfully' : 'Comment not found');
        res.redirect('/home');
    } catch (error) {
        console.log('Error deleting comment:', error);
        req.flash('message', 'Error deleting comment');
        res.redirect('/home');
    }
});

router.post('/deletePost', verify, async (req, res) => {
    try {
        const { postdelete } = req.body;
        const { id } = req.user;
        const post = await postSchema.findById(postdelete);
        if (!post) {
            req.flash('message', 'error deleting post')
            res.redirect('/home')
            return;
        }
        if (id !== post.userRef) {
            req.flash('message', 'you can only delete your own post!')
            res.redirect('/home');
            return;
        }
        const deletedPost = await postSchema.findByIdAndDelete(postdelete);

        if (!deletedPost) {
            req.flash('message', 'Post not found');
        } else {
            req.flash('message', 'Post deleted successfully!');
        }
        res.redirect('/home');
    } catch (error) {
        console.log('Error deleting post:', error);
        req.flash('message', 'Error deleting post');
        res.redirect('/home');
    }
});

router.post('/like', verify, async (req, res) => {
    try {
        const { like } = req.body; // This is the post ID to be liked
        const { id } = req.user; // This is the user ID from the verified user

        // Find the user and the post to be liked
        const currentUser = await userSchema.findById(id);
        const likedPost = await postSchema.findById(like);

        if (!likedPost) {
            req.flash('message', 'Post not found');
            return res.redirect('/home');
        }

        // Check if the user has already liked the post
        const hasLiked = likedPost.like.some(like => like.userRef === id);

        if (hasLiked) {
            req.flash('message', 'You have already liked this post');
            return res.redirect('/home');
        }

        // Add the like to the post
        likedPost.like.push({ userRef: id, username: currentUser.email });
        await likedPost.save();

        console.log('Post liked:', likedPost);
        req.flash('message', 'Post liked successfully');
        res.redirect('/home');
    } catch (error) {
        console.log('Error liking post:', error);
        req.flash('message', 'Error liking post');
        res.redirect('/home');
    }
});

router.post('/update', verify, async (req, res) => {
    const { postId, updatedContent } = req.body;
    const { id } = req.user;

    try {
        // Find the post by postId
        const post = await postSchema.findById(postId);

        // Check if the post exists
        if (!post) {
            req.flash('message', 'Post not found');
            return res.redirect('/home');
        }

        // Check if the user is authorized to update the post
        if (id !== post.userRef.toString()) {
            req.flash('message', 'You can only update your own post!');
            return res.redirect('/home');
        }

        // Update the post content
        const updatedPost = await postSchema.findByIdAndUpdate(postId, { post: updatedContent }, { new: true });

        if (!updatedPost) {
            req.flash('message', 'Error updating post');
        } else {
            req.flash('message', 'Post updated successfully');
        }

        // Redirect to home page after update
        res.redirect('/home');
    } catch (error) {
        console.error('Error updating post:', error);
        req.flash('message', 'Error updating post');
        res.redirect('/home');
    }
});



module.exports = router;