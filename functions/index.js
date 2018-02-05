const functions = require('firebase-functions');
const admin = require('firebase-admin');
var Q = require('q');
admin.initializeApp(functions.config().firebase);

exports.playerPoints = functions.database
    .ref('days/{week}/games/{day}/score').onWrite(event => {


        const data = event.data.val();
        const day = event.params.day;
        const week = event.params.week;

        console.log(data, week, day);

        var promises = [];



        return admin.database().ref(`bets`).once('value').then(function(snapshot) {

            var bets = snapshot.val();


            for (var userKey in bets) {

                var userData = bets[userKey][week][day].bet;


                if (userData == data) {
                    promises.push(

                        admin.database().ref(`bets/${userKey}/${week}/${day}`).update({
                            points: 1,
                            status: 2
                        })

                    )

                } else {
                    promises.push(

                        admin.database().ref(`bets/${userKey}/${week}/${day}`).update({
                            points: 0,
                            status: 2
                        })

                    )
                }

            }



            return Q.all(promises);



        })


    })




// second cloud function

exports.recalculateWeeklyStandings = functions.https.onRequest((request, response) => {

    var promises = []

    admin.database().ref('bets').once("value").then(bets => {
        bets.forEach(bet => {
            var days = bet.val()
            var userkey = bet.key
            for (var daykey in days) {
                var day = days[daykey]
                points = 0
                for (var gamekey in day) {
                    points += day[gamekey].points
                }
                promises.push(
                    admin.database().ref('/ranking_day/' + daykey + '/' + userkey).update({
                        points: points,
                        points_neg: points * (-1)
                    })
                )
            }

        })

        Q.all(promises).then(function() {
            // response.json('success');

            var promises2 = []

            var position = 1
            var actual_position = 0
            var difference = 1
            admin.database().ref('/ranking_day').once('value')
                .then(ranking_days => {
                    ranking_days.forEach(ranking_day => {
                        admin.database().ref('ranking_day/' + ranking_day.key).once('value')
                            .then(ranking_users => {
                                position = 1
                                actual_position = 0
                                difference = 1
                                var index = []
                                var obj_ranking_users = ranking_users.val()
                                for (var x in obj_ranking_users) {
                                    index.push({
                                        'key': x,
                                        'points_neg': obj_ranking_users[x]['points_neg']
                                    });
                                }
                                index.sort(function(a, b) {
                                    var as = a['points_neg'],
                                        bs = b['points_neg'];

                                    return as == bs ? 0 : (as > bs ? 1 : -1);
                                });
                                for (var i = 0; i < index.length; i++) {
                                    position = i + 1
                                    var points = index[i].points_neg
                                    if (points != points_prev) {
                                        actual_position += difference
                                        difference = 1
                                    } else {
                                        difference++
                                    }
                                    if (index[0].points_neg == 0) {
                                        promises2.push(
                                            admin.database().ref('/ranking_day/' + ranking_users.key + '/' + index[i].key).update({
                                                position: position,
                                                position_neg: (position * -1)
                                            })
                                        )
                                    } else {
                                        promises2.push(
                                            admin.database().ref('/ranking_day/' + ranking_users.key + '/' + index[i].key).update({
                                                position: actual_position,
                                                position_neg: (actual_position * -1)
                                            })
                                        )
                                    }
                                    var points_prev = index[i].points_neg
                                }

                                 Q.all(promises2).then(() => {
                                    response.json('success');
                                 }) 
                            })
                         
                    })
                 
                })

                 
        })
    })
})


exports.totalStandings = functions.https.onRequest((request, response) => {
    var promises = []

    admin.database().ref('bets').once("value").then(bets => {
        bets.forEach(bet => {
            var days = bet.val()
            var userkey = bet.key
            total_points = 0
            for (var daykey in days) {
                var day = days[daykey]
                for (var gamekey in day) {
                    total_points += day[gamekey].points
                }

            }
            promises.push(
                admin.database().ref('/ranking_summary/' + userkey).update({
                    points: total_points,
                    points_neg: total_points * (-1)
                })
            )

        })


        Q.all(promises).then(() => {


            console.log("total points updated");


            var promises2 = []
            var position = 1
            var actual_position = 0
            var difference = 1
            admin.database().ref('ranking_summary').once('value')
                .then(ranking_summaries => {

                    position = 1
                    actual_position = 0
                    difference = 1
                    var index = []
                    var obj_ranking_summaries = ranking_summaries.val()
                    for (var x in obj_ranking_summaries) {
                        index.push({
                            'key': x,
                            'points_neg': obj_ranking_summaries[x]['points_neg']
                        });
                    }
                    index.sort(function(a, b) {
                        var as = a['points_neg'],
                            bs = b['points_neg'];

                        return as == bs ? 0 : (as > bs ? 1 : -1);
                    });

                    for (var i = 0; i < index.length; i++) {
                        position = i + 1
                        var points = index[i].points_neg
                        if (points != points_prev) {
                            actual_position += difference
                            difference = 1
                        } else {
                            difference++
                        }

                        promises2.push(

                            admin.database().ref('/ranking_summary/' + index[i].key).update({
                                position: actual_position,
                                position_neg: (actual_position * -1)
                            })

                        )
                        var points_prev = index[i].points_neg
                    }

                    Q.all(promises2).then(() => {
                        response.json('success');
                    })

                })
        })

    })
})