const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    userRef: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    post: {
        type: String,
    },
    imgUrl: {
        type: String
    },
    comment: [
        {
            username:{
                type:String
            },
            text:{
                type:String
            }
        }
    ]
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
