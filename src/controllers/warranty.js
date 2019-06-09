require('dotenv').config();

const express = require('express');
const moment = require('moment');
require('moment/locale/pt-br');
const nodemailer = require('nodemailer');
const puretext = require('puretext');

const tokenMiddleware = require('../middlewares/token');

const router = express.Router();
router.use(tokenMiddleware);

const User = require('../models/user');
const Warranty = require('../models/warranty');

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'garantimos.noreply@gmail.com', // generated ethereal user
      pass: 'garantimossmtp' // generated ethereal password
    }
});

function generateToken() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 8; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

router.post('/create', async(req, res) => {
    try {
        const user = await User.findById(req.tokendecoded);
        
        let data = req.body;
        data.token = generateToken();
        let unique_token = false;

        while(!unique_token) {
            if(!await Warranty.findOne({token: data.token})) {
                unique_token = true;
            }
        }

        let days_to_warrante = data.warranty_date;
        let date = new Date().setDate(new Date().getDate()+days_to_warrante);
        data.warranty_date = new Date(date);
        
        data.client_name = `Cliente ${Date.now()}`;
        data.exchange = 0;

        const warranty = await Warranty.create(data);

        user.warranties.push(warranty);
        await User.findOneAndUpdate({_id: user._id}, user, {new: false}, async (err, warr) => {
            if(data.email != 'no email') {
                var mailOptions = {
                    from: `${user.name}, <${user.email}>`, // sender address
                    to: [data.email], // list of receivers
                    subject: "Garantimos!", // Subject line
                    text: "Olá, estamos aqui pra lhe entregar o token de garantia", // plain text body
                    html: `<p><strong>Ol&aacute;! Viemos entregar o token referente a garantia da sua compra.</strong></p>
                    <p>O e-mail &eacute; referente a compra de um(a) ${warranty.product_name} no valor de R$${warranty.product_price.toString().substr(0, warranty.product_price.toString().length-2)},${warranty.product_price.toString().substr(warranty.product_price.toString().length-2, warranty.product_price.toString().length)}</p>
                    <p>Data da compra: ${moment(new Date()).format('LLL')}</p>
                    <p>A garantia &eacute; v&aacute;lida pros pr&oacute;ximos <span style="text-decoration: underline;">${days_to_warrante} dias</span> a partir da data da compra.</p>
                    <p>&nbsp;</p>
                    <p>Utilize-se deste&nbsp;<em>token</em> para realizar a troca do produto</p>
                    <ul>
                    <li>${warranty.token}</li>
                    </ul>
                    <p>&nbsp;</p>
                    <p>At&eacute; a pr&oacute;xima!</p>
                    <p>&nbsp;</p>`
                    // html body
                };
                await transporter.sendMail(mailOptions);
            }
        });

        return res.send({warranty});
    } catch (error) {
        return res.status(400).send(error);
    }
});

router.post('/:token', async(req, res) => {
    try {
        const warranty = await Warranty.findOne({token: req.params.token});

        if(!warranty)
            return res.status(400).send({error: 'item doesnt exist'});
        
        if(new Date(warranty.warranty_date) > new Date()) {
            return res.send({warranty});
        } else {
            return res.send({warranty: 'the warranty date has passed'});
        };
    } catch (error) {
        return res.status(400).send(error);
    }
});

router.put('/:token/exchange', async(req, res) => {
    try {
        const warranty = await Warranty.findOne({token: req.params.token});

        if(!warranty)
            return res.status(400).send({error: 'item doesnt exist'});

        let days = req.body.warranty_date;
        let new_warranty_date = new Date().setDate(new Date().getDate()+days);
        let exchange = warranty.exchanges + 1;

        await Warranty.findOneAndUpdate({token: req.params.token}, {warranty_date: new_warranty_date, exchanges: exchange}, {new: false}, async(err, warr) => {
            if(!err){
                var mailOptions = {
                    from: `${user.name}, <${user.email}>`, // sender address
                    to: data.email, // list of receivers
                    subject: "Garantimos!", // Subject line
                    text: "Feedback da troca realizada", // plain text body
                    html: `<p><strong>A realiza&ccedil;&atilde;o da troca ocorreu com sucesso.</strong></p>
                    <p>Estamos reenviando o token para que voc&ecirc; utilize em caso de novo problema relativo ao produto adquirido</p>
                    <ul>
                    <li>${warranty.token}</li>
                    </ul>
                    <p>Token v&aacute;lido para os pr&oacute;ximos ${days} dias ap&oacute;s a data da troca</p>
                    <p>Data da troca: ${moment(new Date()).format('LLL')}</p>
                    <p>&nbsp;</p>
                    <p>At&eacute; a pr&oacute;xima!</p>`
                    // html body
                };
                await transporter.sendMail(mailOptions);
                return res.send({success: 'successfully updated'});
            }
            else
                return res.status(400).send(err);
        });
        
    } catch (error) {
        return res.status(400).send(error);
    }
});

module.exports = app => app.use('/warranty', router);