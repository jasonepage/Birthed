# Birthday messages: what the composer opens with

Written September 6, 2026. This is the design of `Birthed/Domain/BirthdayMessage.swift`, the hundred messages it was judged on, and the count.

## What it is

Tapping "It is Sarah's birthday" opens a composer with two sentences already in it. The user changes anything they like and sends it through Messages or the share sheet. The app has no way to send it by itself, makes no network call, and uses nothing but what the user already typed: the person's name, the note about them, the age they are turning if the year is known, whether they are somebody followed, and whether they have died.

The same composer opens from the pink card on the People tab on the day, so it works with reminders switched off.

## The design, and why it is not templates

A template with slots fails in one specific way: it says something the sender did not know they were saying. "Happy birthday Ben, my tall one" from a note that said "the tall one". "Love you" to Sarah's boyfriend because the note said "boyfriend". "Happy 50th" to a dentist. Adding templates does not fix that, because the failure is in what gets said, not in how it is phrased.

So the generator makes four decisions and then says as little as it can.

1. **What to call them.** The note wins when it is what the user calls the person: a note of "Mum" on a person named Karen produces "Happy birthday Mum". Otherwise the first name out of whatever was pasted, so "Priya Ramaswamy" is "Priya" and "SAM JONES" is "Sam". Words that are not a name on their own keep the next one: "Big Dave", "Lil Mo", "Dr Ahmed", "Auntie Carol". "Sam and Alex" stays whole. Anything after a bracket or a dash is dropped, so "Sarah (work)" is "Sarah".

2. **Which register.** Family, partner, polite, distant, casual or plain, read off the note. The note is only ever classified and never quoted. A possessive in the note means the relationship word is about somebody else, so "Sarah's boyfriend" and "mum's friend" are plain. Partner needs the whole note to be the word. A title in the name makes it polite: nobody addressed as Mrs Thompson is told their age.

3. **Whether to say the age.** Only where nobody would mind: children get "Happy 7th birthday", the ages people celebrate (13, 16, 18, 21) and every round number are said to family and friends, friends under thirty get their number, and everybody else gets "Happy birthday" with no number. Never to a partner, never at work, never to somebody the user has lost touch with.

4. **One closing line**, from three plain ones per register. They are deliberately close to one another. The recipient sees one message, and the differences that matter between registers are the address, the comma, the age and the "love you", not the closing.

The message uses contractions ("it's", "you're") where the app's own copy would not, because this is the user's text to a friend and "hope it is a good one" is a sentence nobody types. No exclamation marks, no emoji, no em dashes.

A public figure cannot be texted, so their line is written about them rather than to them: "Beyoncé turns 45 today." Somebody who has died is stated and wished nothing: "Freddie Mercury was born on September 5, 1946."

## What was left out on purpose

- **Facts about the calendar date.** A fact about the date is a fact about the calendar, and the recipient can tell it is not about them. They also live on the server, and this feature makes no network call, so whatever happened to be in memory would be an accident of which tab was open.
- **Gift suggestions, a chatbot, anything that sends on its own.** Not built.
- **A recipient.** Birthed does not know one and does not want to. Messages opens with the text and no "to" field filled in.

## The hundred

Generated on September 6, 2026 with seeds 0, 1 and 2 standing in for the year. The count of messages a person would be embarrassed to send is **two**, marked below, and both are the same limit: a two word name where the first word is not the given name. Nothing in the inputs can tell "Zhang Wei" from "Sarah Jones", and "María José" from "María Sánchez". The user sees the draft before it goes anywhere, and the fix is one word.

The first run of these hundred had four more, and each one changed the generator rather than adding a template: "Happy birthday Big", "Love you" to Sarah's boyfriend, "Happy 50th Dr Ahmed", and "haven't seen in years" being read as a close friend because the apostrophe split the word. Those four are now tests.

1. Karen, note “Mum”, turning 58
    Happy birthday Mum. Hope you have a lovely day.
2. Mum, no note, turning 60
    Happy 60th Mum. Hope it's a good one.
3. Dad, no note, turning 63
    Happy birthday Dad. Hope you have a good day.
4. Steve Page, note “dad”, turning 70
    Happy 70th Dad. Hope you have a lovely day.
5. Nan, no note, turning 84
    Happy birthday Nan. Hope it's a good one.
6. Grandpa Joe, no note, turning 90
    Happy 90th Grandpa Joe. Hope you have a good day.
7. Maria, note “my mom”, turning 49
    Happy birthday Mom. Hope you have a lovely day.
8. Ellie, note “sister”, turning 24
    Happy 24th Ellie. Hope it's a good one.
9. Tom, note “brother”, turning 30
    Happy 30th Tom. Hope you have a good day.
10. Jake, note “little brother”, turning 16
    Happy 16th Jake. Hope you have a lovely day.
11. Auntie Carol, no note, turning 55
    Happy birthday Auntie Carol. Hope it's a good one.
12. Carol, note “aunt”, turning 61
    Happy birthday Carol. Hope you have a good day.
13. Uncle Pete, note “dad's brother”, turning 67
    Happy birthday Uncle Pete. Hope you have a lovely day.
14. Leo, note “nephew”, turning 7
    Happy 7th birthday Leo. Hope it's a good one.
15. Ava, note “niece”, turning 3
    Happy 3rd birthday Ava. Hope you have a good day.
16. Noah, note “godson”, turning 12
    Happy 12th birthday Noah. Hope you have a lovely day.
17. Priya, note “cousin”, turning 27
    Happy 27th Priya. Hope it's a good one.
18. Raj, note “cousin in Perth”, turning 33
    Happy birthday Raj. Hope you have a good day.
19. Sam, note “twin”, turning 19
    Happy 19th Sam. Hope you have a lovely day.
20. Linda, note “mother in law”, turning 66
    Happy birthday Linda. Hope it's a good one.
21. Grace, note “stepmum”, turning 52
    Happy birthday Grace. Hope you have a good day.
22. Ollie, note “cousin's kid”, turning 5
    Happy 5th birthday Ollie. Hope it's a good one.
23. Mum, note “Mum”, age unknown
    Happy birthday Mum. Hope it's a good one.
24. Nonna, no note, turning 88
    Happy birthday Nonna. Hope you have a good day.
25. Alex, note “boyfriend”, turning 22
    Happy birthday Alex. Love you.
26. Jess, note “girlfriend”, turning 21
    Happy birthday Jess. Love you. Hope today is a good one.
27. Chris, note “husband”, turning 41
    Happy birthday Chris. Love you.
28. Dana, note “wife”, turning 40
    Happy birthday Dana. Love you.
29. Sam, note “partner”, age unknown
    Happy birthday Sam. Love you. Hope today is a good one.
30. Mia, note “gf”, turning 19
    Happy birthday Mia. Love you.
31. Sarah, note “best friend”, turning 24
    Happy 24th Sarah. Hope it's a good one.
32. Sarah, note “from school”, turning 24
    Happy birthday Sarah. Hope you're well.
33. Sarah W, note “work”, turning 31
    Happy birthday, Sarah. Hope it's a good one.
34. Sarah (work), no note, age unknown
    Happy birthday Sarah. Hope it's a good one.
35. Ben, note “gym”, turning 28
    Happy 28th Ben. Hope you have a good day.
36. Ben, note “uni”, turning 22
    Happy 22nd Ben. Hope you have a good one.
37. Ben, note “roommate”, turning 21
    Happy 21st Ben. Hope it's a good one.
38. Ben, note “footy”, turning 35
    Happy birthday Ben. Hope you have a good day.
39. Ben, note “band”, age unknown
    Happy birthday Ben. Hope you have a good one.
40. Ben, note “camp”, turning 17
    Happy 17th Ben. Hope it's a good one.
41. Ben, note “the tall one”, turning 26
    Happy 26th Ben. Hope you have a good day.
42. Ben, note “owes me twenty quid”, turning 29
    Happy 29th Ben. Hope you have a good one.
43. Ben, note “Bristol”, turning 43
    Happy birthday Ben. Hope it's a good one.
44. Ben, note “Sarah's boyfriend”, turning 27
    Happy birthday Ben. Hope you have a good day.
45. Ben, note “mum's friend”, turning 57
    Happy birthday Ben. Hope it's a good day.
46. Ben, note “kid from camp”, turning 14
    Happy 14th Ben. Hope it's a good one.
47. Ben, note “met at Glasto”, turning 25
    Happy birthday Ben. Hope you're well.
48. Ben, note “Tinder”, turning 26
    Happy 26th Ben. Hope you have a good one.
49. Ben, note “ex”, turning 25
    Happy birthday Ben. Hope you're doing well.
50. Ben, note “old flatmate”, turning 34
    Happy birthday Ben. Hope you're well.
51. Ben, note “haven't seen in years”, turning 47
    Happy birthday Ben. Hope things are good with you.
52. Ben, note “friend of a friend”, turning 30
    Happy birthday Ben. Hope you're doing well.
53. Ben, note “mate”, turning 18
    Happy 18th Ben. Hope you have a good day.
54. Ben, note “bestie”, turning 13
    Happy 13th Ben. Hope you have a good one.
55. Ben, note “ride or die”, turning 20
    Happy 20th Ben. Hope it's a good one.
56. Ellie, note “Sarah's mum”, turning 55
    Happy birthday Ellie. Hope you have a good day.
57. Ben, note “book club”, turning 64
    Happy birthday Ben. Hope you have a good one.
58. Ben, note “church”, turning 75
    Happy birthday, Ben. Hope you have a good day.
59. Mr Patel, note “teacher”, age unknown
    Happy birthday, Mr Patel. Hope you get to enjoy it.
60. Dr Ahmed, no note, turning 50
    Happy birthday, Dr Ahmed. Hope it's a good one.
61. Claire, note “boss”, turning 45
    Happy birthday, Claire. Hope you have a good day.
62. Claire, note “manager”, turning 40
    Happy birthday, Claire. Hope you get to enjoy it.
63. Claire, note “coworker”, turning 29
    Happy birthday, Claire. Hope it's a good one.
64. Claire, note “client”, age unknown
    Happy birthday, Claire. Hope you have a good day.
65. Claire, note “neighbour”, turning 72
    Happy birthday, Claire. Hope you get to enjoy it.
66. Claire, note “landlord”, age unknown
    Happy birthday, Claire. Hope it's a good one.
67. Claire, note “coach”, turning 36
    Happy birthday, Claire. Hope you have a good day.
68. Claire, note “old teacher”, turning 60
    Happy birthday Claire. Hope you're well.
69. Claire, note “dentist”, age unknown
    Happy birthday, Claire. Hope it's a good one.
70. Claire, note “team lead”, turning 33
    Happy birthday, Claire. Hope you have a good day.
71. Claire, note “LinkedIn”, turning 30
    Happy birthday, Claire. Hope you get to enjoy it.
72. SAM JONES, no note, turning 24
    Happy birthday Sam. Hope it's a good day.
73. sam, no note, turning 24
    Happy birthday Sam. Hope it's a good one.
74. Priya Ramaswamy, no note, turning 26
    Happy birthday Priya. Hope you have a good day.
75. Big Dave, no note, turning 45
    Happy birthday Big Dave. Hope it's a good day.
76. J, no note, age unknown
    Happy birthday J. Hope it's a good one.
77. Sam 🎉, no note, turning 21
    Happy 21st Sam. Hope you have a good day.
78. Sam - gym, no note, turning 30
    Happy 30th Sam. Hope it's a good day.
79. María José, no note, turning 23
    Happy birthday María. Hope it's a good one. **[counted]**
80. Zhang Wei, note “uni”, turning 22
    Happy 22nd Zhang. Hope you have a good day. **[counted]**
81. Ngozi Okafor-Bright, note “work”, age unknown
    Happy birthday, Ngozi. Hope it's a good one.
82. Seán, no note, turning 31
    Happy birthday Seán. Hope it's a good one.
83. Lil Mo, note “cousin”, turning 11
    Happy 11th birthday Lil Mo. Hope it's a good one.
84. Mrs Thompson, note “neighbour”, turning 80
    Happy birthday, Mrs Thompson. Hope it's a good one.
85. Coach Mike, no note, turning 54
    Happy birthday, Coach Mike. Hope you have a good day.
86. Sam and Alex, note “the couple upstairs”, age unknown
    Happy birthday Sam and Alex. Hope you have a good day.
87. Ellie, no note, age unknown
    Happy birthday Ellie. Hope it's a good day.
88. Tom, no note, age unknown
    Happy birthday Tom. Hope it's a good one.
89. Aisha, no note, turning 18
    Happy 18th Aisha. Hope you have a good day.
90. Kai, no note, turning 1
    Happy 1st birthday Kai. Hope it's a good day.
91. Ruth, no note, turning 100
    Happy 100th Ruth. Hope it's a good one.
92. Dev, no note, turning 51
    Happy birthday Dev. Hope you have a good day.
93. Beyoncé, followed
    Beyoncé turns 45 today.
94. Freddie Mercury, followed, died 1991
    Freddie Mercury was born on September 5, 1946.
95. XXXTentacion, followed, died 2018
    XXXTentacion was born on January 23, 1998.
96. Keanu Reeves, followed
    Keanu Reeves turns 62 today.
97. Johann Sebastian Bach, followed, died 1750
    Johann Sebastian Bach was born on March 31, 1685.
98. Jack Antonoff, followed
    Jack Antonoff turns 42 today.
99. Some Streamer, followed
    It's Some Streamer's birthday today.
100. Mac Miller, followed, died 2018
    Mac Miller was born on January 19, 1992.

## How the hundred were made

There is no Swift toolchain on either machine this was written from, so the hundred were generated by a JavaScript mirror of the Swift, kept only for that purpose and not in the repository. `BirthedTests/DomainTests/BirthdayMessageTests.swift` carries all hundred as expected values, so the first `swift test` is what proves the Swift says the same thing. If it fails, the Swift is what is wrong and the expected value is what it should say.
