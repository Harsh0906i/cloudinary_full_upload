require('dotenv').config()
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const userSchema = require('../models/user');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});


router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const existingUser = await userSchema.findOne({ email });
        if (existingUser) {
            req.flash('message', 'user already exists!');
            res.redirect('/');
            return;
        }
        const newUser = new userSchema({
            username,
            email,
            password: hash
        });
        const user = await newUser.save();
        res.redirect('/login');
        req.flash('message', 'Signup successfull!');
    } catch (error) {
        console.log(error)
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body
    try {
        const existingUser = await userSchema.findOne({ email });
        if (!existingUser) {
            req.flash('message', 'user does not exists!')
            res.redirect('/login')
            return;
        }
        const validPassword = await bcrypt.compare(password, existingUser.password);
        if (!validPassword) {
            req.flash('message', 'Invalid password!');
            res.redirect('/login');
            return;
        }
        const token = jwt.sign({ id: existingUser._id }, process.env.JWT);
        res.cookie('access_token', token, { httpOnly: true })
        res.redirect('/home');
    } catch (error) {
        console.log(error);
    }
});

router.post('/forget', async (req, res) => {
    try {
        const { email } = req.body;
        const existingUser = await userSchema.findOne({ email });
        if (!existingUser) {
            req.flash('message', 'user does not exists!');
            res.redirect('/forgetpassword')
            return;
        }
        const token = crypto.randomBytes(32).toString('hex');
        existingUser.resetPasswordToken = token;
        existingUser.resetPasswordExpires = Date.now() + 3600000;
        await existingUser.save();

        const resetUrl = `http://localhost:8080/reset-password?token=${token}`;
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Password Reset',
            text: `You are receiving this because you have requested the reset of the password for your account.\n\n`
                + `Please click on the following link, or paste this into your browser to complete the process:\n\n`
                + `${resetUrl}\n\n`
                + `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                req.flash('message', 'Error sending reset email. Please try again later.');
                res.redirect('/forgetpassword');
            } else {
                console.log('Email sent:', info.response);
                req.flash('message', 'Reset password email sent.');
                res.redirect('/login');
            }
        })

    } catch (error) {
        console.error('Error processing forget password request:', error);
        req.flash('message', 'An error occurred. Please try again later.');
        res.redirect('/forgetpassword');
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { newPassword, token } = req.body;
        const user = await userSchema.findOne({ resetPasswordToken: token });

        if (!user || user.resetPasswordExpires < Date.now()) {
            req.flash('message', 'Invalid or expired token.');
            return res.redirect('/reset-password');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('message', 'Password has been reset successfully.');
        res.redirect('/login');
    } catch (error) {
        console.error('Error resetting password:', error);
        req.flash('message', 'An error occurred. Please try again later.');
        res.redirect('/reset-password');
    }
});

module.exports = router;