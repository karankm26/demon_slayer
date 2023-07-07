const moment = require("moment-timezone");
const mysql = require('mysql2');
const nodemailer = require('nodemailer');

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    database: "lotto",
    password: "",
});
const db = pool.promise();

// console.log(db)

moment.tz.setDefault("Asia/Kolkata");
const current_day = moment().format('dddd').toLowerCase();
// console.log(current_day)
// const current_date = moment().format("YYYY-MM-DD");
const current_date = "2023-06-23";
// const current_time = moment().format("HH:mm");
const current_time = "22:20";
const weekDaysArr = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
let lotteryData = [];

//Common Functions
function arrayIntersect(arr1, arr2) {
    const set = new Set(arr2);
    return arr1.filter((value) => set.has(value));
}

function inArray(needle, haystack) {
    return haystack.includes(needle);
}


function searchForId(search_value, array, id_path) {
    for (let key1 in array) {
        let val1 = array[key1];
        let temp_path = [...id_path];
        if (typeof val1.info === "object" && Object.keys(val1.info)) {
            // console.log(val1)
            for (let key2 in val1.info) {
                let val2 = val1.info[key2];
                // console.log(val2)
                if (val2 === search_value) {
                    temp_path.push(val1);
                    return temp_path[0];
                }
            }
        } else if (val1.info === search_value) {
            temp_path.push({});
            return temp_path;
        }
    }
    return null;
}

// function searchForId(search_value, array, id_path) {
//     for (const key1 in array) {
//         const val1 = array[key1];
//         const tempPath = id_path.slice();
//         // console.log(val1.info)
//         if (typeof val1 === "object" && Object.keys(val1.info)) {
//             console.log("first")
//             for (const key2 in val1.info) {
//                 const val2 = val1.info[key2];

//                 if (val2 === search_value) {
//                     tempPath.push(val1);
//                     return tempPath[0];
//                 }
//             }
//         } else if (val1.info === search_value) {
//             // console.log("first")
//             tempPath.push({});
//             return tempPath;
//         }
//     }

//     return null;
// }


async function sendMail(to, toName, subject, message) {
    try {
        let transporter = nodemailer.createTransport({
            host: 'smtp.hostinger.com',
            port: 465,
            secure: true,
            auth: {
                user: 'support@creativewebsoft.in',
                pass: 'Creative@s430',
            },
        });

        let info = await transporter.sendMail({
            from: '"Agnito Technologies" <support@creativewebsoft.in>',
            to: `${toName} <${to}>`,
            subject: subject,
            html: message,
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.log('Error occurred: ', error);
    }
}






const main = async () => {
    try {
        const [lotteriesResult] = await db.query(`
        select info.image as info_image, info.gameName as info_name, info.gameNumber as info_number, info.gameDuration as info_duration, info.maxNumberTickets as info_max_tickets, info.ticketPrice as info_ticket_price, info.minPrizePool as info_price_pool, info.startTime as info_time, info.id as info_id, info.sold as info_sold, info.nextDraw as info_next_draw, info.status as info_status, GROUP_CONCAT(ticketnos.number order by ticketnos.id) as ticket_numbers from gameInformations as info left join lotterygenerateNos as ticketnos on ticketnos.gameInformationId = info.id where info.status=1 group by info.id order by info.id DESC`);
        const lotteries = lotteriesResult.map((lotteriesRow) => {
            return lotteriesRow;
        });

        // console.log(lotteries, 'lotteries');

        for (let lotteryIndex = 0; lotteryIndex < lotteries.length; lotteryIndex++) {
            const lottery = lotteries[lotteryIndex];
            // console.log(lottery)
            const [lottery_generate_number_qry] = await db.query(`select * from lotterygenerateNos where gameInformationId = "${lottery["info_id"]}" and status = 1`);
            const lottery_generate_number_data = [];
            lottery_generate_number_qry.forEach(lottery_generate_number_row => {
                lottery_generate_number_data.push(lottery_generate_number_row);
            })
            const [phases_qry] = await db.query(`select id as phase_id, game as phase_game, gameData as phase_game_data, status as phase_status, gameInformationId as lottery_id 
            from gamePhases as phase where status=1 and gameInformationId='${lottery["info_id"]}'`);
            const phases = [];

            const phasesData = [];
            for (let phases_qryIndex = 0; phases_qryIndex < phases_qry.length; phases_qryIndex++) {
                const phases_row = phases_qry[phases_qryIndex];

                // console.log(phases_row, 'phases_row')

                // console.log(lottery_generate_number_data.length * parseInt(lottery.info_ticket_price))
                // console.log(parseInt(lottery.info_price_pool))
                // console.log(lottery.info_time <= current_time)
                if (
                    (lottery_generate_number_data.length * parseInt(lottery.info_ticket_price) >= parseInt(lottery.info_price_pool)) ||
                    (lottery.info_time <= current_time)
                ) {
                    // console.log(phases_row.phase_game_data, 'phase_game_data_decode');
                    
                    const phase_game_data_decode = JSON.parse(phases_row.phase_game_data);



                    const phase_game_data = phase_game_data_decode.reduce((a, b) => {
                        return a.frequency < b.frequency ? a : b;
                    }, phase_game_data_decode.shift());
                    // console.log(phase_game_data, "phase_game_data")
                    //####
                    if (phase_game_data['frequency'] == 1) {
                        console.log('Daily')
                        if (lottery["info_next_draw"] == 1) {
                            if (current_time <= lottery["info_time"]) {
                                await db.query(`update gameInformations set gameDuration = '${current_date}' where id = '${lottery["info_id"]}'`);

                            } else {
                                await db.query(`update gameInformations set gameDuration = '${moment().add(1, 'day').format('YYYY-MM-DD')}'  where id = ${lottery["info_id"]}`);
                            }
                        } else {
                            await db.query(`update gameInformations set gameDuration = '${current_date}', nextDraw = '1' where id = ${lottery["info_id"]}`);
                        }
                       
                    }
                    else if (phase_game_data['frequency'] == 2) {
                        console.log(phase_game_data['frequency'] == 2);
                        console.log("Weekly");

                        const weeklyDaysDate1 = [];
                        const fetchWeekDays = [];
                        for (let i = 0; i < phase_game_data.schedules.length; i++) {
                            fetchWeekDays.push(phase_game_data.schedules[i].value);
                        }
                        const commonWeekDays = arrayIntersect(weekDaysArr, fetchWeekDays);
                        // const commonWeekDays = weekDaysArr.filter(day => fetchWeekDays.includes(day));

                        // console.log(lottery.info_time)

                        const weeklyDateArr = [];
                        if (commonWeekDays.includes(moment().format('dddd').toLowerCase())) { //66
                            // console.log(current_date,"!!!!!!!!!!!!!!!!!!!!");
                            if (current_time <= lottery["info_time"]) {
                                await db.query(`update gameInformations set gameDuration = "${current_date}" where id = "${lottery['info_id']}"`);

                            } else {
                                commonWeekDays.forEach(cwd => {
                                    const weeklyDate1 = moment().day(cwd).add(1, 'week').format('YYYY-MM-DD');
                                    weeklyDateArr.push(weeklyDate1);
                                    console.log(weeklyDate1,);
                                });
                                // const weeklyDate2 = (weeklyDateArr[0]);
                                //  console.log(weeklyDate2, 'weeklyDate2')

                                if (weeklyDateArr[0] > lottery["info_duration"]) { //75##
                                    await db.query(`update gameInformations set gameDuration = "${weeklyDateArr[0]}"where id = "${lottery['info_id']}"`);
                                } else {
                                    await db.query(`update gameInformations set gameDuration = "${weeklyDateArr[0]}", nextDraw = '1' where id = "${lottery['info_id']}"`)
                                }
                            }
                        } else {
                            // console.log("2nd");
                            commonWeekDays.forEach(cwd => {
                                const weeklyDate3 = moment().day(cwd).add(1, 'week');
                                weeklyDateArr.push(weeklyDate3);
                            });
                            // const weeklyDate4 = weeklyDateArr[0];
                            if (weeklyDate4 > lottery["info_duration"]) {
                                await db.query(`update gameInformations set gameDuration = "${weeklyDateArr[0]}" where id = ${lottery['info_id']}`)
                            } else {
                                // console.log("2nd");
                                await db.query(`update gameInformations set gameDuration = "${weeklyDateArr[0]}", nextDraw = '1' where id = "${lottery['info_id']}"`)
                            }
                            // }               
                        } //#91

                    } else if (phase_game_data['frequency'] == 3) {  //91###
                        console.log('Monthly');
                        const fetchMonthDays = [];
                        for (let j = 0; j < phase_game_data.schedules.length; j++) {
                            fetchMonthDays.push(phase_game_data.schedules[j].value);
                        }
                        fetchMonthDays.sort();

                        const lastMonthDay = fetchMonthDays[fetchMonthDays.length - 1];
                        if (moment().date() > lastMonthDay) { //98##
                            console.log("first")
                            const currentDate = moment();
                            const nextMonth = currentDate.add(1, 'month').format('YYYY-MM');
                            const firstDayOfMonth = moment(nextMonth).startOf('month').format('YYYY-MM-DD');
                            const reachedMonthlyDate = `${firstDayOfMonth}-${fetchMonthDays[0].toString().padStart(2, '0')}`;
                            if (lottery["info_next_draw"] == 1) {
                                await db.query(`update gameInformations set gameDuration = '${reachedMonthlyDate}' where id = "${lottery["info_id"]}"`)
                            } else {
                                await db.query(`update gameInformations set gameDuration = '${reachedMonthlyDate}', nextDraw = '1' where id = "${lottery["info_id"]}"`)
                            }
                        }
                        else if (fetchMonthDays.includes(current_day)) { //107##
                            console.log("Second");
                            if (current_time <= lottery["info_time"]) {//108###
                                const inTimeMonthlyDate = moment().format('YYYY-MM-DD');
                                if (lottery["info_next_draw"] == 1) {
                                    await db.query(`update gameInformations set gameDuration = '${inTimeMonthlyDate}' where id = "${lottery["info_id"]}"`);
                                } else {
                                    await db.query(`update gameInformations set gameDuration = '${inTimeMonthlyDate}', nextDraw = '1' where id = "${lottery["info_id"]}"`);
                                }
                            } else { //116###
                                const monthlyNextDay = moment().add(1, 'day').format('D');
                                const monthlyLastDay = moment().endOf('month').format('D');
                                const monthlyFoundDay = [];
                                fetchMonthDays.forEach((element) => {
                                    if (element >= monthlyNextDay && element <= monthlyLastDay) {
                                        monthlyFoundDay.push(element);
                                    }
                                });
                                if (monthlyFoundDay.length > 0) {//126###
                                    const monthlyFoundDate = moment().format('YYYY-MM') + '-' + (monthlyFoundDay[0].length === 1 ? '0' + monthlyFoundDay[0] : monthlyFoundDay[0]);

                                    if (lottery["info_next_draw"] == 1) {
                                        db.query(`update gameInformations set gameDuration = '${monthlyFoundDate}' where id = "${lottery["info_id"]}"`);
                                    } else {
                                        db.query(`update gameInformations set gameDuration = '${monthlyFoundDate}', nextDraw = '1' where id = "${lottery["info_id"]}"`);
                                    }
                                } else { //134
                                    const monthlyNotFoundDate = moment().add(1, 'month').startOf('month').format('YYYY-MM-') + (fetchMonthDays[0].length === 1 ? '0' + fetchMonthDays[0] : fetchMonthDays[0]);

                                    if (lottery["info_next_draw"] == 1) {
                                        await db.query(`update gameInformations set gameDuration = 
                                        '${monthlyNotFoundDate}' where id = "${lottery["info_id"]}"`)
                                    } else {
                                        await db.query(`update gameInformations set gameDuration = 
                                        '${monthlyNotFoundDate}', nextDraw = '1' where id = "${lottery["info_id"]}"`)
                                    }
                                }
                            }
                        }
                        else {//144##

                            console.log("Three  Nikal Gai");
                            const monthlyNextDay1 = moment().add(1, 'day').format('D');
                            const monthlyLastDay1 = moment().endOf('month').format('D');
                            const monthlyFoundDay1 = [];
                            fetchMonthDays.forEach((element) => {
                                if (element >= monthlyNextDay1 && element <= monthlyLastDay1) {
                                    monthlyFoundDay1.push(element);
                                }
                            });
                            const monthlyPostDate = moment().format('YYYY-MM-') + (monthlyFoundDay1[0].length === 1 ? '0' + monthlyFoundDay1[0] : monthlyFoundDay1[0]);

                            if (lottery["info_next_draw"] == 1) {
                                await db.query(`update gameInformations set gameDuration = '${monthlyPostDate}' where id = "${lottery["info_id"]}"`);
                                // console.log("Three  Nikal Gai !!!!!!!!!!!!!!!");
                            } else {
                                await db.query(`update gameInformations set gameDuration = '${monthlyPostDate}', nextDraw = '1' where id = "${lottery["info_id"]}"`)
                            }
                        }
                    }
                    phases.push(phases_row);
                    // console.log(phases_row)
                }
                var lotteryData = []
                lotteryData.push({ "info": lottery, "phases": phases });
                // console.log(phases)
                // console.log(phases_row)
            }
            // console.log(lotteryData,"!!!!!!!!!!")

            lotteryData = searchForId(current_time, lotteryData, []);

            // console.log(lotteryData, 'lotteryData')

            if (lotteryData) {
                if ((lotteryData.info.info_next_draw) == 1) {
                    const buy_tickets_qry = db.query(`select * from BuyTickets where lotteryId = '${lotteryData.info.info_id}'`)
                    // console.log(buy_tickets_qry)
                    // let buyTicketsData = [];
                    // var buy_tickets_row = [];
                    // while (buy_tickets_row = await buy_tickets_qry.fetchSync()) {
                    //     buyTicketsData.push(buy_tickets_row);
                    // }
                    const buyTicketsData = [];
                    const resultSet = await db.query(`select * from BuyTickets where lotteryId = '${lotteryData.info.info_id}'`);
                    const rows = resultSet[0];
                    for (let i = 0; i < rows.length; i++) {
                        const buy_tickets_row = rows[i];
                        buyTicketsData.push(buy_tickets_row);
                    }
                    // console.log(buyTicketsData)
                    let buyTicketsAmountArr = [];
                    buyTicketsData.forEach((buyTicket) => {
                        buyTicketsAmountArr.push(parseInt(buyTicket.totalPrice));
                        // console.log(buyTicketsAmountArr,'buyTicketsAmountArr');
                    });
                    // buyTicketsAmount = reduce(buyTicketsAmountArr);

                    for (let lotteryDataIndex = 0; lotteryDataIndex < lotteryData.phases.length; lotteryDataIndex++) {
                        const phase = lotteryData.phases[lotteryDataIndex];
                        const phase_game_data = JSON.parse(phase.phase_game_data);
                        // console.log(phase_game_data)

                        for (let phase_game_dataIndex = 0; phase_game_dataIndex < phase_game_data.length; phase_game_dataIndex++) {
                            const game_data = phase_game_data[phase_game_dataIndex];

                            if (game_data.frequency == 1) {
                                let numbers = lotteryData.info.ticket_numbers.split(",");

                                let winners = game_data.winners;
                                if (winners != 0) {
                                    let nuGet = [];
                                    if (winners == 1) {
                                        nuGet = Array.from({ length: parseInt(winners) }, () => Math.floor(Math.random() * numbers.length));
                                    } else {
                                        // nuGet = Array.from({ length: winners }, () => numbers[Math.floor(Math.random() * numbers.length)]);
                                        for (let i = 0; i < parseInt(winners); i++) {
                                            const randomIndex = Math.floor(Math.random() * numbers.length);
                                            nuGet.push(randomIndex);
                                        }
                                    }

                                    if (nuGet.length > 0) {
                                        for (let numsIndex = 0; numsIndex < nuGet.length; numsIndex++) {
                                            const nums = nuGet[numsIndex];
                                            // console.log(`SELECT * FROM BuyTickets WHERE tickets LIKE '%${numbers[nums]}%'`)
                                            const [ticket_qry_1] = await db.query(`SELECT * FROM BuyTickets WHERE tickets LIKE '%${numbers[nums]}%'`)
                                            // console.log(ticket_qry_1, "ticket_qry_1")

                                            const [ticket] = ticket_qry_1;
                                            // console.log(ticket);
                                            if (ticket) {
                                                db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase.lottery_id}', '${parseInt(ticket.UserId)}', '${phase.phase_id}', '${numbers[nums]}', '${game_data.frequency}')`);

                                                const [users_qry] = await db.query(`select * from Users where id = '${parseInt(ticket.UserId)}'`);

                                                console.log(users_qry, 'users_qry')
                                                // while (users_row = await users_qry.fetchRow()) {
                                                // console.log(users_qry.then(res=> console.log(res)))
                                                for (let users_qryIndex = 0; users_qryIndex < users_qry.length; users_qryIndex++) {
                                                    const users_row = users_qry[users_qryIndex];
                                                    // const users_row = rows[i];
                                                    console.log(users_row, 'users_row')
                                                    const totalBalance = parseInt(users_row["balance"]) + parseInt(game_data.prize);
                                                    console.log(totalBalance, "totalBalance")
                                                    // Change with Tushar Start------------------------
                                                    const [cwts_qry] = await db.query(`select win_trx_count from Users where id = '${users_row["id"]}'`)
                                                    const cwts_win_trx = [];
                                                    for (const cwts_row of cwts_qry) {
                                                        const win_trx_count = parseInt(cwts_row["win_trx_count"]) + 1;
                                                        cwts_win_trx.push(win_trx_count);
                                                    }
                                                    // Change with Tushar END-----------------------------

                                                    db.query(`update Users set balance = '${totalBalance}', win_trx_count = '${cwts_win_trx[0]}' where id = '${users_row["id"]}'`)

                                                    const mailUserName = users_row["fname"] + " " + users_row["lname"];
                                                    const mailTicketNumber = numbers[nums];
                                                    const mailLotteryName = lotteryData.info.info_name;
                                                    const mailLink = "http://159.223.51.198:5000/winners";
                                                    const mailWinningAmount = game_data.prize;
                                                    const mailRemainingTime = new Date(lotteryData.info.info_duration + " " + lotteryData.info.info_time);
                                                    mailRemainingTime.setDate(mailRemainingTime.getDate() + 1);
                                                    const mailRemainingTimeFormatted = `${mailRemainingTime.getDate()}/${mailRemainingTime.getMonth() + 1}/${mailRemainingTime.getFullYear()} ${mailRemainingTime.getHours()}:${mailRemainingTime.getMinutes()}`;
                                                    const to = users_row["email"];
                                                    const toName = mailUserName;
                                                    const subject = "Congratulations " + mailUserName;
                                                    const message = `Hi ${mailUserName},
                                                    Congratulations! you got the winning of ${mailWinningAmount} in your recent draw for the 
                                                    ${mailLotteryName} and ticket number: ${mailTicketNumber}.
                                                    See your winning status (<a href="${mailLink}" target="_blank">click here</a>).
                                                    Your next draw for this lottery will take place on ${mailRemainingTimeFormatted}.
                                                    
                                                    Keep playing, keep winning,
                                                    The team Lifetime Lotto.`;

                                                    // sendMail(to, toName, subject, message);
                                                }
                                            }
                                            else {
                                                db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase["lottery_id"]}', null, '${phase["phase_id"]}', '${numbers[nums]}', '${game_data.frequency}')`);
                                            }
                                            const newDateTime = moment(lotteryData.info.info_duration).add(1, 'day').format('YYYY-MM-DD');
                                            // console.log(lotteryData.info.info_id)
                                            db.query(`UPDATE gameInformations SET gameDuration = '${newDateTime.trim()}' WHERE id = ${lotteryData.info.info_id}`);
                                            const [ticket_qry_2] = await db.query(`select * from BuyTickets where lotteryId = '${lotteryData.info.info_id}' and tickets not like '%${numbers[nums]}%'`);
                                            for (let ticket_qry_2Index = 0; ticket_qry_2Index < ticket_qry_2.length; ticket_qry_2Index++) {
                                                const ticket_row_2 = ticket_qry_2[ticket_qry_2Index];
                                                // console.log(ticket_row_2,"ticket_row_2")
                                                // console.log(parseInt(ticket_row_2.UserId))
                                                const [ticket_row_users_qry] = await db.query(`select * from Users where id = '${parseInt(ticket_row_2.UserId)}'`)


                                                const [ticket_row_users_row] = ticket_row_users_qry;
                                                // console.log(ticket_row_users_row)
                                                const ticket_row_2_split = ticket_row_2.tickets.split('|');
                                                // console.log(ticket_row_2_split)
                                                for (let ticket_row_2_splitIndex = 0; ticket_row_2_splitIndex < ticket_row_2_split.length; ticket_row_2_splitIndex++) {
                                                    const row_2_split = ticket_row_2_split[ticket_row_2_splitIndex];
                                                    const mailUserName1 = ticket_row_users_row.fname + " " + ticket_row_users_row.lname;
                                                    const mailLotteryName1 = lotteryData.info.info_name;
                                                    const mailTicketNumber1 = row_2_split;
                                                    const mailLink1 = "http://159.223.51.198:5000/winners";
                                                    const mailRemainingTime1 = `
                                                        <script>
                                                            var day = new Date(${lotteryData.info.info_duration} ${lotteryData.info.info_time});
                                                            var nextDay = new Date(day);
                                                            nextDay.setDate(day.getDate() + 1);
                                                            document.write(nextDay.getDate()+'/'+(nextDay.getMonth() + 1)+'/'+nextDay.getFullYear()+' '+nextDay.getHours()+':'+nextDay.getMinutes());
                                                        </script>
                                                    `;
                                                    const to1 = ticket_row_users_row.email;
                                                    const toName1 = mailUserName1;
                                                    const subject1 = "Better Luck Next Time!";
                                                    const message1 = `Hi ${mailUserName1},<br />
                                                    This time it wasn't yours. You didn't hit the winning prize in your recent draw for the ${mailLotteryName1} 
                                                    and ticket number: ${mailTicketNumber1}. Maybe the next draw can bring luck for you.<br />
                                                    You can see your win/lose status from (<a href='${mailLink1}' target='_blank'>click here</a>) anytime.<br />
                                                    Your next draw for this lottery will take place on ${mailRemainingTime1}.<br /><br />
                                                    Keep playing, keep winning,<br />
                                                    The team Lifetime Lotto.`;

                                                    // sendMail(to1, toName1, subject1, message1);

                                                }
                                            }
                                        }
                                    }

                                }
                            }
                            else if (game_data.frequency == 2) {
                                console.log("first!!!!!!!!!!!!!!!!!!!")
                                const current_day = moment().format('dddd').toLowerCase();
                                const schedule = [];
                                for (const schedules of game_data.schedules) {
                                    if (schedules.value === current_day) {
                                        schedule.push(schedules.value);
                                    }
                                }
                                if (schedule.length > 0) {
                                    const weeklyDaysDate = [];
                                }
                                for (let scheduleIndex = 0; scheduleIndex < schedule.length; scheduleIndex++) {
                                    const sche = schedule[scheduleIndex];
                                    const weeklyDate = moment().day(sche).add(7, 'days');
                                    const formattedDate = weeklyDate.format('YYYY-MM-DD');
                                    if (formattedDate > (lotteryData.info.info_duration)) {
                                        weeklyDaysDate.push(formattedDate);
                                    }
                                    if (current_day == sche) {
                                        let numbers;
                                        numbers = lotteryData.info.ticket_numbers.split(",");
                                        const winners = game_data.winners;
                                        if (winners != 0) {
                                            if (winners === 1) {
                                                let nuGet;
                                                nuGet = Array.from({ length: winners }, () => numbers[Math.floor(Math.random() * numbers.length)]);
                                            } else {
                                                nuGet = Array.from({ length: winners }, () => numbers[Math.floor(Math.random() * numbers.length)]);
                                            }
                                            if (nuGet.length > 0) {
                                                // for (let keyIndex = 0; keyIndex < nuGet.length; keyIndex++) {
                                                //     let nums = nuGet[key];
                                                for (let numsIndex = 0; numsIndex < nuGet.length; numsIndex++) {
                                                    const nums = nuGet[numsIndex];
                                                    const ticket_qry_1 = db.query(`select * from BuyTickets where tickets like '%${numbers[$nums]}%'`);
                                                    const ticket = ticket_qry_1.fetchSync();
                                                    if (ticket) {
                                                        db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase["lottery_id"]}', '${parseInt(ticket["UserId"])}', '${phase["phase_id"]}', '${numbers[nums]}', '${game_data.frequency}')`)
                                                        const users_qry = db.query(`select * from Users where id = '${parseInt(ticket["UserId"])}'`);
                                                        while (users_row = users_qry.fetchSync()) {
                                                            const totalBalance = parseInt(users_row.balance) + parseInt(game_data.prize);
                                                            // Change with Tushar Start
                                                            const cwts_qry = db.query(`select win_trx_count from Users where id = '${users_row["id"]}'`)
                                                            const cwts_win_trx = [];
                                                            for (const cwts_row of cwts_qry) {
                                                                const win_trx_count = parseInt(cwts_row["win_trx_count"]) + 1;
                                                                cwts_win_trx.push(win_trx_count);
                                                            }
                                                            // Change with Tushar END
                                                        }
                                                        db.query(`update Users set balance = '${totalBalance}', win_trx_count = '${cwts_win_trx[0]}' where id = '${users_row["id"]}'`);
                                                        const mailUserName = users_row.fname + " " + users_row.lname;
                                                        const mailTicketNumber = numbers[nums];
                                                        const mailLotteryName = lotteryData.info.info_name;
                                                        const mailLink = "http://159.223.51.198:5000/winners";
                                                        const mailWinningAmount = game_data.prize;
                                                        const mailRemainingTime = `
                                                            <script>
                                                                var day = new Date(${lotteryData.info.info_duration} ${lotteryData.info.info_time});
                                                                var nextDay = new Date(day);
                                                                nextDay.setDate(day.getDate() + 1);
                                                                document.write(nextDay.getDate()+'/'+(nextDay.getMonth() + 1)+'/'+nextDay.getFullYear()+' '+nextDay.getHours()+':'+nextDay.getMinutes());
                                                            </script>
                                                        `;
                                                        const to = users_row.email;
                                                        const toName = mailUserName;
                                                        const subject = "Congratulations " + mailUserName;
                                                        const message = `Hi ${mailUserName},<br />
                                                        Congratulations! You have won ${mailWinningAmount} in your recent draw for the ${mailLotteryName} and 
                                                        ticket number: ${mailTicketNumber}.<br />
                                                        See your winning status (<a href='${mailLink}' target='_blank'>click here</a>).<br />
                                                        Your next draw for this lottery will take place on ${mailRemainingTime}.<br /><br />
                                                        Keep playing, keep winning,<br />
                                                        The team Lifetime Lotto.`;
                                                        sendMail(to, toName, subject, message);


                                                    }
                                                    else {
                                                        db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase["lottery_id"]}', null, '${phase["phase_id"]}', '${numbers[nums]}', '${game_data.frequency}')`);
                                                    }
                                                    const ticket_qry_2 = db.query(`select * from BuyTickets where lotteryId = '${lotteryData.info.info_id}' and tickets not like '%${numbers[nums]}%'`)
                                                    while (ticket_row_2 = ticket_qry_2.fetchSync()) {
                                                        const ticket_row_users_qry = db.query(`select * from Users where id = '${parseInt(ticket_row_2["UserId"])}'`);
                                                        const ticket_row_users_row = ticket_row_users_qry.fetchSync();
                                                        const ticket_row_2_split = ticket_row_2.tickets.split("|");
                                                        for (let ticket_row_2_splitIndex = 0; ticket_row_2_splitIndex < ticket_row_2_split.length; ticket_row_2_splitIndex++) {
                                                            const row_2_split = ticket_row_2_split[ticket_row_2_splitIndex];
                                                            const mailUserName1 = ticket_row_users_row.fname + " " + ticket_row_users_row.lname;
                                                            const mailLotteryName1 = lotteryData.info.info_name;
                                                            const mailTicketNumber1 = row_2_split;
                                                            const mailLink1 = "http://159.223.51.198:5000/winners";
                                                            const mailRemainingTime1 = `
                                                                <script>
                                                                    var day = new Date(${lotteryData.info.info_duration} ${lotteryData.info.info_time});
                                                                    var nextDay = new Date(day);
                                                                    nextDay.setDate(day.getDate() + 1);
                                                                    document.write(nextDay.getDate()+'/'+(nextDay.getMonth() + 1)+'/'+nextDay.getFullYear()+' '+nextDay.getHours()+':'+nextDay.getMinutes());
                                                                </script>
                                                            `;
                                                            const to1 = ticket_row_users_row.email;
                                                            const toName1 = mailUserName1;
                                                            const subject1 = "Better Luck Next Time!";
                                                            const message1 = `Hi ${mailUserName1},<br />
                                                            This time it wasn't yours. You didn't hit the winning prize in your recent draw for the ${mailLotteryName1} 
                                                            and ticket number: ${mailTicketNumber1}. Maybe the next draw can bring luck for you.<br />
                                                            You can see your win/lose status from (<a href='${mailLink1}' target='_blank'>click here</a>) anytime.<br />
                                                            Your next draw for this lottery will take place on ${mailRemainingTime1}.<br /><br />
                                                            Keep playing, keep winning,<br />
                                                            The team Lifetime Lotto.`;

                                                            sendMail(to1, toName1, subject1, message1);
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                    }
                                }
                                if ((weeklyDaysDate.length) > 0) {
                                    db.query(`update gameInformations set gameDuration = '${weeklyDaysDate[0]}', nextDraw = '1' where id = '${lotteryData.info.info_id}'`)
                                }
                            }
                            else if (game_data.frequency == 3) {
                                const current_day = (new Date()).getDate();
                                const schedule = [];
                                game_data.schedules.forEach((schedules) => {
                                    if (schedules.value === current_day) {
                                        schedule.push(schedules.value);
                                    }
                                });
                                if ((schedule.length) > 0) {
                                    const monthlyDaysDate = [];
                                    for (let scheduleIndex = 0; scheduleIndex < schedule.length; scheduleIndex++) {
                                        const sche = schedule[scheduleIndex];
                                        const currentDate = moment().format('YYYY') + '-' + moment().format('M') + '-' + sche;
                                        const monthlyDate = moment(currentDate);
                                        const formattedDate = monthlyDate.format('YYYY-MM-DD');
                                        if (formattedDate > lotteryData.info.info_duration) {
                                            monthlyDaysDate.push(formattedDate);
                                        }
                                        if (current_day === sche) {
                                            numbers = lotteryData.info.ticket_numbers.split(",");
                                            winners = game_data.winners;
                                            if (winners != 0) {
                                                if (winners === 1) {
                                                    let nuGet;
                                                    nuGet = Array.from({ length: winners }, () => numbers[Math.floor(Math.random() * numbers.length)]);
                                                } else {
                                                    nuGet = Array.from({ length: winners }, () => numbers[Math.floor(Math.random() * numbers.length)]);
                                                }
                                                if (nuGet.length > 0) {
                                                    // for (let keyIndex = 0; keyIndex < nuGet.length; keyIndex++) {
                                                    //     let nums = nuGet[key];
                                                    for (let numsIndex = 0; numsIndex < nuGet.length; numsIndex++) {
                                                        const nums = nuGet[numsIndex];
                                                        const ticket_qry_1 = db.query(`select * from BuyTickets where tickets like '%${numbers[$nums]}%'`)
                                                        const ticket = ticket_qry_1.fetchSync();
                                                        if (ticket) {
                                                            db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase["lottery_id"]}', '${parseInt(ticket["UserId"])}', '${phase["phase_id"]}', '${numbers[nums]}', '${game_data.frequency}')`)
                                                            const users_qry = db.query(`select * from Users where id = '${parseInt(ticket["UserId"])}'`);
                                                            while (users_row = users_qry.fetchSync()) {
                                                                const totalBalance = parseInt(users_row["balance"]) + parseInt(game_data.prize);
                                                                // Change with Tushar Start
                                                                const cwts_qry = db.query(`select win_trx_count from Users where id = '${users_row["id"]}'`)
                                                                const cwts_win_trx = [];
                                                                for (const cwts_row of cwts_qry) {
                                                                    const win_trx_count = parseInt(cwts_row["win_trx_count"]) + 1;
                                                                    cwts_win_trx.push(win_trx_count);
                                                                }
                                                                // Change with Tushar END

                                                                db.query(`update Users set balance = '${totalBalance}', win_trx_count = '${cwts_win_trx[0]}' where id = '${users_row["id"]}'`);
                                                                const mailUserName = users_row.fname + ' ' + users_row.lname;
                                                                const mailTicketNumber = numbers[nums];
                                                                const mailLotteryName = lotteryData.info.info_name;
                                                                const mailLink = 'http://159.223.51.198:5000/winners';
                                                                const mailWinningAmount = game_data.prize;
                                                                const mailRemainingTime = `
                                                                    <script>
                                                                        var day = new Date(${lotteryData.info.info_duration} ${lotteryData.info.info_time});
                                                                        var nextDay = new Date(day);
                                                                        nextDay.setDate(day.getDate() + 1);
                                                                        document.write(nextDay.getDate()+'/'+(nextDay.getMonth() + 1)+'/'+nextDay.getFullYear()+' '+nextDay.getHours()+':'+nextDay.getMinutes());
                                                                    </script>
                                                                `;
                                                                const to = users_row.email;
                                                                const toName = mailUserName;
                                                                const subject = 'Congratulation ' + mailUserName;
                                                                const message = `Hi ${mailUserName},<br />
                                                                    Congratulations! you got the winning amount of ${mailWinningAmount} in your recent draw for 
                                                                    the ${mailLotteryName} and ticket number: ${mailTicketNumber}.<br />
                                                                    See your winning status (<a href="${mailLink}" target="_blank">click here</a>).<br />
                                                                    Your next draw for this lottery will take place in ${mailRemainingTime}.<br /><br />
                                                                    Keep playing, keep Winning,<br />
                                                                    The team Lifetime Lotto.`;
                                                                sendMail(to, toName, subject, message);
                                                            }

                                                        } else {
                                                            db.query(`insert into Winners (gameInformationId, UserId, gamePhaseId, ticketNumber, frequency) values('${phase["lottery_id"]}', null, '${phase["phase_id"]}', '${numbers[$nums]}', '${game_data.frequency}')`);
                                                        }
                                                        const ticket_qry_2 = db.query(`select * from BuyTickets where lotteryId = '${lotteryData.info.info_id}' and tickets not like '%${numbers[$nums]}%'`);
                                                        while (ticket_row_2 = ticket_qry_2.fetchSync()) {
                                                            const ticket_row_users_qry = db.query(`select * from Users where id = '${parseInt(ticket_row_2["UserId"])}'`);
                                                            const ticket_row_users_row = ticket_row_users_qry.fetchSync();
                                                            const ticket_row_2_split = ticket_row_2.tickets.split("|");
                                                            for (let ticket_row_2_splitIndex = 0; ticket_row_2_splitIndex < ticket_row_2_split.length; ticket_row_2_splitIndex++) {
                                                                const sche = ticket_row_2_split[ticket_row_2_splitIndex];
                                                                const mailUserName1 = ticket_row_users_row["fname"] + " " + ticket_row_users_row["lname"];
                                                                const mailLotteryName1 = lotteryData.info.info_name;
                                                                const mailTicketNumber1 = row_2_split;
                                                                const mailLink1 = "http://159.223.51.198:5000/winners";
                                                                const mailRemainingTime1 = `
                                                                    <script>
                                                                        var day = new Date(${lotteryData.info.info_duration} ${lotteryData.info.info_time});
                                                                        var nextDay = new Date(day);
                                                                        nextDay.setDate(day.getDate() + 1);
                                                                        document.write(nextDay.getDate()+'/'+(nextDay.getMonth() + 1)+'/'+nextDay.getFullYear()+' '+nextDay.getHours()+':'+nextDay.getMinutes());
                                                                    </script> `;

                                                                const to1 = ticket_row_users_row["email"];
                                                                const toName1 = mailUserName1;
                                                                const subject1 = "Better Luck Next Time!";
                                                                const message1 = `Hi ${mailUserName1},
                                                                    This time it wasn't yours. You didn't hit the winning prize in your recent draw for the 
                                                                    ${mailLotteryName1} and ticket number: ${mailTicketNumber1}. Maybe the next draw can bring luck for you.
                                                                    You can see your win/lose status from (<a href='${mailLink1}' target='_blank'>click here</a>) anytime.
                                                                    Your next draw for this lottery will take place on ${mailRemainingTime1}.
                                                                    
                                                                    Keep playing, keep winning,
                                                                    The team Lifetime Lotto.`;
                                                                sendMail(to1, toName1, subject1, message1);
                                                            }

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if ((monthlyDaysDate.length) > 0) {
                                        db.query(`update gameInformations set gameDuration = '${monthlyDaysDate[0]}', nextDraw = '1' where id = "${lotteryData.info.info_id}"`);
                                    }

                                }

                            }
                        };
                    }
                    console.log("Job successfully started")
                }
                else {
                    console.log("Job failed")
                }
            }
            else {
                console.log("Job failed! Tata")
            }
        }
    } catch (error) {
        console.log("error", error)

    }

}
main();