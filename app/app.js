const process = require('process');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');

const local_app = function () {}

// * ———————————————————————————————————————————————————————— * //
// * 	init
// *
// *	gets called upon starting enduro.js production server
// *	@param {express app} app - express app
// *	@return {nothing}
// * ———————————————————————————————————————————————————————— * //
local_app.prototype.init = function (app) {
    // Make sure that we're registering middleware and routes into
    // our router, otherwise we may interfere with the admin interface.
    const router = new express.Router();
    // middleware
    app.use(helmet());
    if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('dev'));
    }
    router.use(express.json());
    router.use(express.urlencoded({extended: false}));
    router.use(cookieParser());

    // routes
    router.use('/contact-us', require('./routes/contact-us'));
    router.use('/paypal',     require('./routes/paypal'));
    router.use('/booking',    require('./routes/booking'));
    app.use('/api', router);
    app.use('/booking-admin', require('./routes/bookings-admin-ui'));
}

module.exports = new local_app()
