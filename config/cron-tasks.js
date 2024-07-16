const { format } = require("date-fns");
const {
  compareAsc,
  getHours,
  subSeconds,
  startOfDay,
  startOfMinute,
  getMinutes,
  differenceInDays,
  getDay,
  differenceInWeeks,
  startOfWeek,
  differenceInMonths,
  startOfMonth,
  getDate,
  previousMonday,
  addDays,
  endOfMonth,
  subDays,
  nextMonday
} = require("date-fns");




module.exports = {
  /**
   * Simple example.
   * Every monday at 1am.
   */

  myJob: {
    task: async ({ strapi }) => {
      let events = await strapi.entityService.findMany("api::event.event", {
        fields: ['title', 'description', 'start', 'end', 'allDay', 'rrule_text', 'repeat_data', 'duration', 'action', 'synced_with_google', 'reminder'],
        populate: ['owner'],
        filters: { deleted: false }
      })

      if (events.length == 0) return;

      const eventList = [];

      events.filter((item) => item.owner !== null).forEach((event, index) => {
        const { repeat_data: { start, end, freq, interval, weeklyRepeatOn, monthlyRepeatOn }, allDay, reminder } = event;

        const now = new Date();
        // return if notification start time is later than now
        if (compareAsc(new Date(), subSeconds(start, reminder)) === -1) return;

        if (!allDay) {
          switch (freq.value) {
            case 'Monthly':
              const monthlyList = ['On day 25', 'On the fourth Monday', 'On the last Monday'];
              if (monthlyRepeatOn.value === monthlyList[0] && getDate(now) !== 25) return;
              if (monthlyRepeatOn.value === monthlyList[1] && getDate(nextMonday(subDays(startOfMonth(now), 1))) + 21 !== getDate(now)) return;
              if (monthlyRepeatOn.value === monthlyList[2] && getDate(previousMonday(addDays(endOfMonth(now), 1))) !== getDate(now)) return;
              if (
                compareAsc(startOfDay(now), startOfDay(subSeconds(start, reminder))) >= 0 &&
                differenceInMonths(startOfMonth(now), startOfMonth(start)) % interval === 0 &&
                getHours(now) * 60 + getMinutes(now) === getHours(start) * 60 + getMinutes(start) - reminder / 60
              )
                eventList.push(event);
              break;
            case 'Weekly':
              const weeklyDays = weeklyRepeatOn.map(item => item.value);
              const weekDays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
              if (
                compareAsc(startOfDay(now), startOfDay(subSeconds(start, reminder))) >= 0 &&
                differenceInWeeks(startOfWeek(now), startOfWeek(start)) % interval === 0 &&
                weeklyDays.includes(weekDays[getDay(now)]) &&
                getHours(now) * 60 + getMinutes(now) === getHours(start) * 60 + getMinutes(start) - reminder / 60
              )
                eventList.push(event)
              break;
            case 'Daily':
              if (
                compareAsc(startOfDay(now), startOfDay(subSeconds(start, reminder))) >= 0 &&
                differenceInDays(startOfDay(now), startOfDay(start)) % interval === 0 &&
                getHours(now) * 60 + getMinutes(now) === getHours(start) * 60 + getMinutes(start) - reminder / 60
              )
                eventList.push(event)
              break;
            default:
              if (!
                (startOfMinute(now), startOfMinute(subSeconds(start, reminder))))
                eventList.push(event)
              break;
          }
        } else if (new Date().getHours() === 8 && new Date().getMinutes() === 0) {
          switch (freq.value) {
            case 'Monthly':
              const monthlyList = ['On day 25', 'On the fourth Monday', 'On the last Monday'];
              if (monthlyRepeatOn.value === monthlyList[0] && getDate(now) !== 25) return;
              if (monthlyRepeatOn.value === monthlyList[1] && getDate(nextMonday(subDays(startOfMonth(now), 1))) + 21 !== getDate(now)) return;
              if (monthlyRepeatOn.value === monthlyList[2] && getDate(previousMonday(addDays(endOfMonth(now), 1))) !== getDate(now)) return;
              if (
                compareAsc(startOfDay(now), startOfDay(start)) >= 0 &&
                differenceInMonths(startOfMonth(now), startOfMonth(start)) % interval === 0
              )
                eventList.push(event);
              break;
            case 'Weekly':
              const weeklyDays = weeklyRepeatOn.map(item => item.value);
              const weekDays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
              if (
                compareAsc(startOfDay(now), startOfDay(start)) >= 0 &&
                differenceInWeeks(startOfWeek(now), startOfWeek(start)) % interval === 0 &&
                weeklyDays.includes(weekDays[getDay(now)])
              )
                eventList.push(event)
              break;
            case 'Daily':
              if (
                compareAsc(startOfDay(now), startOfDay(start)) >= 0 &&
                differenceInDays(startOfDay(now), startOfDay(start)) % interval === 0
              )
                eventList.push(event)
              break;
            default:
              if (compareAsc(startOfDay(now), startOfDay(start)))
                eventList.push(event)
              break;
          }
        }
      });
      const newList = []
      eventList.forEach((event) => {
        if (event.owner.notification_enable) {
          newList.push({
            notificationOwner: event.owner.id,
            title: event.title,
            description: event.description,
            date: format(new Date(), "PP"),
            time: event.allDay
              ?
              'allDay'
              :
              `${format(new Date(event.start), "kk")}:${format(new Date(event.start), "mm")} to ${format(new Date(event.end), "kk")}:${format(new Date(event.end), "mm")}`,
            status: 'false'
          })
        }
      })


      const notificationTokens = await strapi.entityService.findMany("api::notification-token.notification-token", {
        fields: ['notification_token'],
        populate: ['owner']
      })

      if (notificationTokens.length > 0) {
        const notificationData = newList.map((item) => {
          return {
            ...item,
            notificationTokens: notificationTokens.filter((token) => token.owner?.id === item.notificationOwner).map((item) => item.notification_token)
          }
        })
        notificationData.forEach(({ title, description, date, time, notificationTokens, status }) => {
          notificationTokens.forEach(async (token) => {
            const body = {
              data: {
                title,
                description,
                date,
                time,
                status
              },
              notification: { title, body: description },
              token,
            };
            try {
              const res = await strapi.controller('api::send-notifications.send-notifications').sendNotificationsForCronJob(body);
              if (res) {
                console.log({ res });
              }
            } catch (error) {
              console.log("error", error);
            }
          })
        })
      }


      newList.map(async (item) => {
        try {
          const res = await strapi.entityService.create("api::notification.notification", {
            data: {
              title: item.title,
              description: item.description,
              notificationOwner: item.notificationOwner,
              status: item.status,
              date: item.date,
              time: item.time
            }
          })
        } catch (error) {

        }
      })
    },
    options: {
      rule: "*/1 * * * *",
    },
  },
};