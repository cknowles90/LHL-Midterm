const express           = require('express');
const router            = express.Router();
const userQueries       = require('../db/queries/users');
const uuid              = require('uuid');
const pollExists        = require('../db/queries/does_poll_exist');
const getQuestions      = require('../db/queries/get_questions_for_poll');
const reisterVotes      = require('../db/queries/register_votes')
const pollDetails       = require('../db/queries/return_poll_details');
const addAnswer         = require('../db/queries/add_result_to_answers');
const hasVoted          = require('../db/queries/has_voted');
const changeStatus      = require('../db/queries/change_vote_status');
const userEmailById     = require('../db/queries/find_user_by_email');
const userIdbyEmail     = require('../db/queries/find_id_by_email');
const insertBorda       = require('../db/queries/insert_borda_results');
const userExists        = require('../db/queries/user_exists');
const authorizedEmail   = require('../db/queries/authorized_email');

const db                = require('../db/connection');
const authorizedToVote  = require('../db/queries/authorized_to_vote');

const newUuid           = uuid.v4();

router.get('/:id', (req, res) => {
  const values = req.params.id;
  // const myCookieValue = req.cookies.myCookie;
  // console.log("here is the cookie value", myCookieValue)
  // console.log("cookie does or does not exist", req.session.userId)
  console.log(values);

  const userEmail = req.cookies.choiceMaker;

  pollExists(values)
    .then((uuidExists) => {
      if (!uuidExists) {
        res.send("Error: That is not a valid uuid");
      } else {
        console.log('log for the id being passed in for the voting link', values);
        return pollDetails(values)
        .then((pollData) => {
          return getQuestions(values)
          .then((questionData) => {
            // res.json({ pollData, questionData });
            res.render('submit-poll', { pollData, questionData, values, userEmail });
          })
        }).catch((pollDetailsError) => {
          console.error(pollDetailsError);
          res.status(500).send("Internal Server Error");
        });
      }
  }).catch((error) => {
    console.error(error);
    res.status(500).send("Internal Server Error");
  });
});



router.post('/:id/submit', async (req, res) => {

  try {
    const userEmail = req.body.email;

    console.log("testing to make sure userEmail is not empty", userEmail)
    delete req.body.email;
    console.log(req.body)

    const user = await userExists(userEmail);
    console.log(user);

    if (!user) {
      return res.status(403).send(
        `You are not authorized for this poll.
         <a href="/login">Please sign in</a> to access this page.`
      );
    }

    if (user) {
      // req.session.usersEmail = userEmail;
      res.clearCookie('choiceMaker');
      res.cookie('choiceMaker', userEmail);
      console.log("cookie checking the if user fucntion", userEmail)
        }

    const uuid = req.body.uuid;
    delete req.body.uuid;
    console.log("logging uuid from post page", uuid)

    const pollId = req.body.poll_id;
    delete req.body.poll_id;
    console.log("checking for pollid being placed properly", pollId);

    const responceData = req.body;
    // const userEmail = req.cookies.myCookie;
    console.log("first user email so find breakage", userEmail)

    if (typeof userEmail === 'undefined') {
      console.log("checking for user email existing or being undevined", userEmail)
      return res.status(401).send({ error: 'User not logged in. Please log in.' });
    }

    const userIdObject = await userIdbyEmail(userEmail);
    console.log(userIdObject)

    const userId = userIdObject[0].id;
    console.log("second console log to find if userId is being retrieved", userId);

    const canVote = await authorizedToVote(userId, pollId);
    console.log("checking to see if authorized to vote", canVote);

    if (!canVote) {
      return res.status(403).json({ error: 'You are not authorized for this poll'});
    }

    const emails = await authorizedEmail(userId, pollId);
    console.log("lookinng to see what kind of emails come out", emails);

    const hasVotedResult = await hasVoted(userId, pollId);
    console.log("hasVotedResult:", hasVotedResult);

    if (hasVotedResult) {
      return res.status(403).json({ error: 'User has already voted' });
    }
    // The user is found; you can proceed
    console.log(userEmail);

    // Loop through and add the answers and add to the table
    for (const key in responceData) {
      if (responceData.hasOwnProperty(key)) {
        const question = key;
        const result = responceData[key];
        await addAnswer(userId, pollId, question, result);
      }
    }

    await changeStatus(userId, pollId);
    await insertBorda(pollId);

    // Send a response or redirect as needed
    res.redirect(`/results/${uuid}`);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
