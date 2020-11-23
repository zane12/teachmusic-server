const express = require("express");
const braintree = require("braintree")
const moment = require("moment")

const router = express.Router();

const Student = require("../models/Student")

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

router.get("/payment/:id", async (req, res) => {
    try{
      const _id = req.params.id
  
      let student = await Student.findById(_id)
  
      if(!student || student === null) res.status(404).send();
      
  
      student = await student.populate({path: "lessons"}).execPopulate();
      
      // const currentLessons = student.lessons.filter((lesson) => {
      //   if(!lesson.cancelled) return moment(lesson.lessonDate).isSame(new Date(), 'month')
      // })
  
      res.send(student.lessons)
      
  
    }
  
    catch(e) {
      console.log(e)
      res.status(500).send()
    }
  })
  
router.post("/payment/:id", async (req, res) => {
    try{
      const body = req.body;
      
      
      //find lessons this month to add to subscription
      let add = [];

      const student = await new Student(body.student)
        .populate({ path: "lessons" })
        .execPopulate();

        let count = 0;
        
      student.lessons.forEach((lesson) => {
        if(moment(lesson.lessonDate).isSame(new Date(), 'month')) {
          count++;
          return; 
        }
      })

      if(count > 0) {
        add = [{
          amount: 30,
          inheritedFromId: process.env.BRAINTREE_LESSON_ADDON,
          neverExpires: true,  
          quantity: count          
        }]
      }

         

      //create customer
      gateway.customer.create({
        firstName: body.student.contactFirstName,
        lastName: body.student.contactLastName,
        email: body.student.email,
        phone: body.student.contactPhone,
        paymentMethodNonce: body.nonce.nonce
      }).then((result) => {

        
        //then if the customer is created successfully, attach the id to the Student, 
        // and create a subscription for monthly billing with lesson addons
        if(result.success) {
          Student.findByIdAndUpdate(body.student._id, { braintreeId: result.customer.id }, 
            (err, res) => {if(err) throw new Error(err)});

          gateway.subscription.create({
            paymentMethodToken: result.customer.paymentMethods[0].token,
            planId: process.env.BRAINTREE_PLAN_ID,
            neverExpires: true,
            addOns: {add}
          }).then(async (result) => {             
            console.log(body.student._id + " " + result.subscription.id);
            await Student.findByIdAndUpdate(body.student._id, { braintreeSubscriptionId: result.subscription.id })
            return; 
          }).catch((e) => { console.log(e) });
        } else {
          throw new Error(result)
          
        }

      }).catch((e) => {throw new Error(e)})
      
      
      res.send(JSON.stringify(body))
    }
    catch(e){
      return
    }
  })

module.exports = router;