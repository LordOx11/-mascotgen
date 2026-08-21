// ⏳ PURGATORY — THE REALM
// ============================================================================
// Seven floors, seventy-seven scenes. One scene is drawn per floor per run, so
// no two descents are the same and the same six rooms never repeat.
//
// A "floor" is NOT a room. It is an administrative region the size of a
// country. The bureaucracy is uniform; the place is enormous. That scale is
// what makes room for Zyrek finding a rebuilt village down here, for the
// Watchers' post at the bottom, and for the Legion to come UP through it.
//
// TONE — the three rules that keep this from becoming the other place:
//   · NEVER fire, torture, torment, demons or brimstone. Purgatory is grey,
//     ordinary and administrative, and that is exactly what makes it
//     frightening: a thousand years, and it is Tuesday.
//   · NOBODY IS IN CHARGE. There is no judge and no sentence. There is a file.
//     If your file is wrong, it is still your file. Gravel owns the LEDGER,
//     which is not the same as owning the place.
//   · Every floor sits above one of the seven roots and takes its character
//     from what is beneath it — WITHOUT EVER SHOWING WHAT THAT IS. The floor's
//     mood is the hint. Naming the root is the leak.
//
// DEATH DOWN HERE: you are never destroyed. You are RESET — returned to Intake
// with the run void and your file reopened. Worse than dying, and it costs the
// player nothing real (writing rule 9).
//
// SCENE SHAPE: { id, text, options:[{ id, label, debt, tag, need? }] }
//   · debt  — added to what you owe the ledger. Negative pays it down.
//   · tag   — a past-tense clause. These are concatenated into the chapter
//             prompt, so they must read as "they <did the thing>".
//   · need  — { stat: "power"|"hp"|"speed"|"special", min } gates the option.
//             Locked options stay VISIBLE. A door you can see but cannot open
//             is a reason to build a different mascot.
// ============================================================================

export const PURGATORY_FLOORS = [
  // ==========================================================================
  {
    id: "intake",
    title: "FLOOR ONE — INTAKE",
    feel: "Queues past the horizon. Counters that never close. Grey daylight with no source.",
    scenes: [
      { id: "i1", text: "A clerk asks for your full name and does not look up. The ledger is open. The pen has been used by a great many people.", options: [
        { id: "a", label: "Give the whole of it.", debt: 0, tag: "gave their full name to a clerk who did not look up, and heard it read back with one syllable slightly wrong" },
        { id: "b", label: "Give the short version.", debt: 0, tag: "gave a clerk the short version of their name and watched it get written down as though it were the whole thing" },
        { id: "c", label: "Say nothing at all.", need: { stat: "hp", min: 6 }, debt: 1, tag: "refused to give a name at Intake, and was assigned a number that they were still carrying a thousand years later" },
      ]},
      { id: "i2", text: "The queue does not move. The person ahead of you says they have been here four years. They say it the way someone mentions the weather.", options: [
        { id: "a", label: "Settle in and wait.", debt: 0, tag: "settled into the Intake queue without complaint, which the clerks noticed and never mentioned" },
        { id: "b", label: "Ask what they're waiting for.", debt: 0, tag: "asked what the queue was for and got an answer that explained nothing and was completely honest" },
        { id: "c", label: "Walk to the front.", need: { stat: "power", min: 7 }, debt: 2, tag: "walked to the front of a queue four years deep, and was seen immediately, and paid for it later" },
      ]},
      { id: "i3", text: "Your file is already on the counter. It is thicker than it should be for someone who just arrived.", options: [
        { id: "a", label: "Read it.", need: { stat: "special", min: 6 }, debt: 0, tag: "read their own Intake file and found entries dated before they died" },
        { id: "b", label: "Close it. Don't look.", debt: 0, tag: "closed their own file at Intake without reading it, and has wondered about that ever since" },
        { id: "c", label: "Ask who wrote it.", debt: 1, tag: "asked who had written their file before they arrived, and was told that was not a question the desk handled" },
      ]},
      { id: "i4", text: "A clerk apologises. There has been an error. Someone with your name was processed eleven years ago.", options: [
        { id: "a", label: "Insist you're you.", debt: 0, tag: "spent their first day in Purgatory proving they were themselves to a clerk holding someone else's paperwork" },
        { id: "b", label: "Accept the other file.", debt: 3, tag: "accepted a file belonging to someone else because it was faster, and carried a stranger's debts the whole way down" },
        { id: "c", label: "Ask to meet them.", debt: 1, tag: "asked to meet the person who had arrived eleven years earlier under their name, and was told the request was noted" },
      ]},
      { id: "i5", text: "There is a bench. There are people on it who arrived long enough ago that the bench has worn to their shape.", options: [
        { id: "a", label: "Sit with them.", debt: 0, tag: "sat on the Intake bench with people who had worn a groove in it, and said nothing for a long time" },
        { id: "b", label: "Stay standing.", debt: 0, tag: "refused to sit down at Intake, on the theory that sitting down was how it started" },
        { id: "c", label: "Ask how long.", debt: 0, tag: "asked the ones on the bench how long they had been there and received three different answers, all confident" },
      ]},
      { id: "i6", text: "You are handed a ticket. The number on it is very high. Nobody explains what the number counts.", options: [
        { id: "a", label: "Keep it. Say thank you.", debt: 0, tag: "took their Intake ticket, thanked the clerk, and kept the number for the rest of the descent" },
        { id: "b", label: "Ask what it counts.", debt: 0, tag: "asked what the number on their ticket counted, and the clerk said it counted tickets, and that was the end of it" },
        { id: "c", label: "Drop it and walk on.", need: { stat: "speed", min: 6 }, debt: 1, tag: "dropped their ticket on the Intake floor and walked on, which caused problems on three separate floors afterwards" },
      ]},
      { id: "i7", text: "Someone is being turned away at the far counter. Not sent on — turned away. They are told, politely, that they are not dead.", options: [
        { id: "a", label: "Watch. Say nothing.", debt: 0, tag: "watched someone be politely informed that they were not dead, and understood that this was possible" },
        { id: "b", label: "Ask if that can be checked.", debt: 0, tag: "asked whether their own status could be double-checked, and was told the desk did not do that" },
        { id: "c", label: "Follow them out.", need: { stat: "speed", min: 7 }, debt: 2, tag: "followed the one who was turned away as far as the doors, and did not see where they went" },
      ]},
      { id: "i8", text: "The grey daylight has no source and does not change. A clerk mentions, unprompted, that it has been this exact brightness the entire time.", options: [
        { id: "a", label: "Look for the source.", need: { stat: "special", min: 6 }, debt: 0, tag: "spent their first weeks looking for the source of Intake's light, and concluded there was not one" },
        { id: "b", label: "Stop noticing it.", debt: 0, tag: "deliberately stopped noticing the light at Intake, which they later understood was the first thing this place teaches you" },
        { id: "c", label: "Ask about night.", debt: 0, tag: "asked when it got dark, and the clerk paused for the first time in the entire conversation" },
      ]},
      { id: "i9", text: "A woman is arguing that she was supposed to be sent up, not down. She has the paperwork. It is correct.", options: [
        { id: "a", label: "Back her up.", debt: 1, tag: "spoke up for a stranger at Intake whose paperwork was correct and whose destination was not, and achieved nothing" },
        { id: "b", label: "Look away.", debt: 0, tag: "looked away while a woman with correct paperwork was sent the wrong direction, and remembered her face" },
        { id: "c", label: "Take her name.", debt: 0, tag: "quietly took the name of a woman who had been sent the wrong way, and carried it down with them" },
      ]},
      { id: "i10", text: "They ask how you died. There is a dropdown of options on the form and none of them are it.", options: [
        { id: "a", label: "Pick the nearest one.", debt: 0, tag: "chose the closest available option for how they died, none of which was correct, and signed it anyway" },
        { id: "b", label: "Insist on writing it in.", need: { stat: "special", min: 7 }, debt: 0, tag: "insisted on writing in their own cause of death rather than choosing from a list, and the clerk allowed it, which was unusual" },
        { id: "c", label: "Say you'd rather not.", debt: 1, tag: "declined to state how they died, and the field was left blank, and blank fields attract attention down here" },
      ]},
      { id: "i11", text: "The clerk finishes, stamps, and says: 'Floor two, when you're ready.' Nobody is ever ready and everyone goes.", options: [
        { id: "a", label: "Go straight down.", debt: 0, tag: "went down to the second floor the moment they were released, without looking back at the queue" },
        { id: "b", label: "Wait a while first.", debt: 0, tag: "waited at Intake for a long time after being processed, for no reason they could name" },
        { id: "c", label: "Ask what's on floor two.", debt: 0, tag: "asked what was on the second floor and was told, accurately and unhelpfully, that it was where people go" },
      ]},
      { id: "i12", text: "Someone hands you a folded paper and says 'you'll want this on five.' They are gone before you can ask.", options: [
        { id: "a", label: "Pocket it. Don't read it.", debt: 0, tag: "was handed a folded paper at Intake and carried it unread all the way to the fifth floor" },
        { id: "b", label: "Read it now.", need: { stat: "special", min: 6 }, debt: -1, tag: "read the note they were handed at Intake straight away, and arrived on the fifth floor already knowing one thing they should not have" },
        { id: "c", label: "Refuse it.", debt: 1, tag: "refused a stranger's folded paper at Intake, and thought about it on every floor afterwards" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "wards",
    title: "FLOOR TWO — THE WARDS",
    feel: "The dead sort themselves by how they died. Whole districts. They rebuild what they lost, badly, out of memory and nothing.",
    scenes: [
      { id: "w1", text: "You find your own kind without meaning to — the ones who went the way you went. One of them has been waiting long enough to know your name already.", options: [
        { id: "a", label: "Sit down and listen.", debt: 0, tag: "sat with the ones who died the same way they did and listened for what felt like a hundred years" },
        { id: "b", label: "Ask how they knew your name.", need: { stat: "special", min: 6 }, debt: 0, tag: "asked how a stranger in the Wards already knew their name, and understood the answer far too quickly" },
        { id: "c", label: "Walk away from them.", debt: 0, tag: "walked away from their own kind on the second floor and did the rest of it alone" },
      ]},
      { id: "w2", text: "A district here is a village rebuilt from memory. The proportions are wrong in the way that memory is wrong. Everyone in it is pleased to see a visitor.", options: [
        { id: "a", label: "Stay for a meal.", debt: 0, tag: "ate a meal in a village the dead had rebuilt from memory, where the proportions were wrong and nobody mentioned it" },
        { id: "b", label: "Ask what happened to it.", debt: 0, tag: "asked a rebuilt village what had happened to the original, and got the story from six people who each had a different piece" },
        { id: "c", label: "Leave before dark.", debt: 0, tag: "left a rebuilt village before the light changed, without being able to say why they were in a hurry" },
      ]},
      { id: "w3", text: "The drowned district floods twice a day. Nobody has fixed it. Everyone has adapted.", options: [
        { id: "a", label: "Help move things upstairs.", debt: -1, tag: "spent a season in the drowned district helping carry furniture upstairs twice a day, for people who had nowhere else to be" },
        { id: "b", label: "Ask why nobody fixes it.", debt: 0, tag: "asked why the drowned district was never repaired and was told that it was not broken, it was just how that district was" },
        { id: "c", label: "Keep walking.", debt: 0, tag: "walked through the drowned district without stopping, water to the ankle the whole way" },
      ]},
      { id: "w4", text: "Someone recognises you. Not from your life — from a story about your life. They have some of it wrong and they are very fond of the wrong parts.", options: [
        { id: "a", label: "Let them keep it.", debt: 0, tag: "let a stranger keep the wrong version of their story because the wrong version had done them good" },
        { id: "b", label: "Correct them.", debt: 0, tag: "corrected a stranger's account of their own life, and watched something go out of the conversation afterwards" },
        { id: "c", label: "Ask who told it.", need: { stat: "special", min: 6 }, debt: 0, tag: "traced a story about themselves back through four tellings in the Wards and never found who started it" },
      ]},
      { id: "w5", text: "There is a whole ward of people who died the same day, in the same event, and they have never once discussed it.", options: [
        { id: "a", label: "Respect the silence.", debt: 0, tag: "spent time in a ward of people who all died on the same day and never once raised it, and did not raise it either" },
        { id: "b", label: "Ask one of them.", debt: 1, tag: "asked someone in the silent ward what had happened that day, and was answered, and wished they had not asked" },
        { id: "c", label: "Ask about anything else.", debt: 0, tag: "sat with people who all died together and talked to them about everything except that, which turned out to be what they wanted" },
      ]},
      { id: "w6", text: "A man is building a house one board at a time from materials that keep not quite existing. He has been at it for a long time.", options: [
        { id: "a", label: "Help him build.", debt: -1, tag: "helped a man in the Wards build a house out of materials that kept not quite existing, and did not ask what it was for" },
        { id: "b", label: "Tell him it won't hold.", debt: 1, tag: "told a man in the Wards that his house would never hold, which was true, and which he already knew" },
        { id: "c", label: "Ask who it's for.", debt: 0, tag: "asked who the half-built house in the Wards was for, and the answer was a name they did not recognise" },
      ]},
      { id: "w7", text: "The betrayed have their own district and it is the friendliest one here. Nobody finds that strange except you.", options: [
        { id: "a", label: "Stay a while.", debt: 0, tag: "stayed in the district of the betrayed, which was the warmest place on the second floor, and never worked out why" },
        { id: "b", label: "Ask why they're kind.", debt: 0, tag: "asked the betrayed why their district was the kindest one down there, and got an answer that took a century to understand" },
        { id: "c", label: "Don't go in.", debt: 0, tag: "walked the long way around the district of the betrayed rather than go through it" },
      ]},
      { id: "w8", text: "Two wards share a wall and have not spoken in eight hundred years. Nobody now living in either remembers the reason.", options: [
        { id: "a", label: "Carry a message across.", debt: -1, tag: "carried a message between two wards that had not spoken in eight hundred years, and neither side thanked them, and both read it" },
        { id: "b", label: "Find out the reason.", need: { stat: "special", min: 7 }, debt: 0, tag: "dug up the original reason two wards stopped speaking eight centuries ago, and found it was an administrative error" },
        { id: "c", label: "Leave it alone.", debt: 0, tag: "left an eight-hundred-year silence between two wards exactly where they found it" },
      ]},
      { id: "w9", text: "Someone offers to take you to a district where they say people from your world are kept together. You did not know there was one.", options: [
        { id: "a", label: "Go with them.", debt: 0, tag: "was taken to a district where their own people were said to be kept together, and found some of them, and not the ones they were looking for" },
        { id: "b", label: "Ask why it's separate.", debt: 0, tag: "asked why their own people had a district of their own down here and did not like the shape of the answer" },
        { id: "c", label: "Decline.", debt: 0, tag: "declined to be taken to where their own people were gathered, and never went, and never fully explained that" },
      ]},
      { id: "w10", text: "A child has been on this floor longer than most of the adults. They are exactly as old as when they arrived and they are running the errands.", options: [
        { id: "a", label: "Ask them for directions.", debt: 0, tag: "took directions from a child who had been in the Wards longer than anyone else on the floor, and the directions were perfect" },
        { id: "b", label: "Ask how long.", debt: 1, tag: "asked a child in the Wards how long they had been there, and the number was wrong in a way that stayed with them" },
        { id: "c", label: "Give them something.", debt: -1, tag: "gave the ward-child the only thing they still had on them, and got a receipt for it, which the child insisted on" },
      ]},
      { id: "w11", text: "You are told, casually, that some people never leave floor two. Not because they can't. Because down is optional.", options: [
        { id: "a", label: "Keep going down.", debt: 0, tag: "kept descending after learning that the second floor was as far as anyone had to go" },
        { id: "b", label: "Ask what's wrong with staying.", debt: 0, tag: "asked what was wrong with simply staying on the second floor and received no argument against it, which was the argument" },
        { id: "c", label: "Consider staying.", need: { stat: "hp", min: 7 }, debt: -1, tag: "seriously considered never going below the second floor, stayed a long while deciding, and then went down anyway" },
      ]},
      { id: "w12", text: "A woman asks you to look for someone on the lower floors. She gives you a name and no description and says you'll know.", options: [
        { id: "a", label: "Take the name.", debt: 0, tag: "accepted a name from a woman in the Wards and carried it down looking for someone they would apparently recognise" },
        { id: "b", label: "Ask for a description.", debt: 0, tag: "asked for a description to go with the name and was told there was no point, they would know" },
        { id: "c", label: "Say no.", debt: 1, tag: "refused to carry a stranger's name down to the lower floors, and thought about her on every one of them" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "markets",
    title: "FLOOR THREE — THE MARKETS",
    feel: "The dead own nothing, so they trade in what's left: time, names, memories, favours. Debt starts here. The ledger belongs to somebody upstairs.",
    scenes: [
      { id: "m1", text: "Someone finds you. They are polite, they are not lying, and what they want is small. They can move you down a floor faster than the stairs allow.", options: [
        { id: "a", label: "Take the shortcut.", debt: 3, tag: "took a stranger's shortcut on the third floor and did not read what it cost" },
        { id: "b", label: "Read it first.", need: { stat: "special", min: 6 }, debt: 1, tag: "read the whole agreement out loud before signing it, while the stranger waited, and negotiated one line of it" },
        { id: "c", label: "Refuse and take the stairs.", debt: 0, tag: "refused a free shortcut on the third floor and walked down instead, which took considerably longer" },
      ]},
      { id: "m2", text: "A stall trades in years. Not yours — anyone's. The proprietor is careful to say that everything here was given freely.", options: [
        { id: "a", label: "Buy nothing.", debt: 0, tag: "walked past a stall trading in other people's years without buying, which the proprietor found rude" },
        { id: "b", label: "Ask where they came from.", need: { stat: "special", min: 7 }, debt: 0, tag: "asked a market trader where the years on his stall had come from, and got a full and honest answer" },
        { id: "c", label: "Sell one of yours.", debt: -2, tag: "sold a year of their own on the third-floor market to clear a debt, and could not afterwards say which year it had been" },
      ]},
      { id: "m3", text: "Somebody is auctioning a name. It is a good name. The current owner is standing right there and appears to be fine with it.", options: [
        { id: "a", label: "Watch it sell.", debt: 0, tag: "watched a man sell his own name at auction on the third floor and stand there afterwards without one" },
        { id: "b", label: "Bid.", debt: 2, tag: "bid on another person's name at a Purgatory auction, lost, and was relieved" },
        { id: "c", label: "Ask him why.", debt: 0, tag: "asked a man why he was selling his own name and the reason was so practical that it was hard to argue with" },
      ]},
      { id: "m4", text: "A broker offers to buy a memory. He specifies which one. You had not told anybody about it.", options: [
        { id: "a", label: "Refuse. Walk away.", debt: 0, tag: "refused to sell a memory to a broker who should not have known they had it, and left quickly" },
        { id: "b", label: "Ask how he knew.", need: { stat: "special", min: 7 }, debt: 1, tag: "asked a memory broker how he knew what was in their head, and the answer involved the fifth floor" },
        { id: "c", label: "Sell it.", debt: -3, tag: "sold one specific memory on the third floor for enough to clear everything they owed, and has never been able to name what was sold" },
      ]},
      { id: "m5", text: "The market has a lost-property office. It is enormous. Everything in it belongs to someone who is still here.", options: [
        { id: "a", label: "Look for something of yours.", debt: 0, tag: "searched Purgatory's lost-property office for something of their own and found an item they did not remember owning" },
        { id: "b", label: "Hand something in.", debt: -1, tag: "handed something in to the lost-property office on the third floor and was given a numbered slip that they kept" },
        { id: "c", label: "Don't go in.", debt: 0, tag: "declined to enter the lost-property office, on the grounds that they did not want to find anything" },
      ]},
      { id: "m6", text: "A debt collector is working the row. He is not frightening. He is simply extremely accurate, and he is not collecting from you.", options: [
        { id: "a", label: "Watch him work.", debt: 0, tag: "watched a collector work the third-floor market and learned more from ten minutes of it than from anything else down there" },
        { id: "b", label: "Ask who he works for.", debt: 0, tag: "asked a debt collector on the third floor who he worked for, and was told a name they already knew from the living world" },
        { id: "c", label: "Settle up early.", need: { stat: "hp", min: 6 }, debt: -2, tag: "settled their own debts early on the third floor, before anyone asked, which was noted somewhere" },
      ]},
      { id: "m7", text: "Two traders are arguing about whether something counts as a favour or a loan. It has been going on for decades. Both are enjoying it.", options: [
        { id: "a", label: "Rule on it.", need: { stat: "special", min: 6 }, debt: 0, tag: "settled a decades-old argument between two traders about the difference between a favour and a loan, and both accepted the ruling" },
        { id: "b", label: "Take a side.", debt: 1, tag: "took a side in a trader dispute on the third floor and made an enemy who was very patient about it" },
        { id: "c", label: "Move on.", debt: 0, tag: "left two traders to an argument they had been enjoying for decades" },
      ]},
      { id: "m8", text: "There is a queue for a stall selling nothing. The people in it know it sells nothing. They are queuing anyway.", options: [
        { id: "a", label: "Join the queue.", debt: 0, tag: "queued for a stall that sold nothing, along with everyone else who knew it sold nothing" },
        { id: "b", label: "Ask them why.", debt: 0, tag: "asked why anyone queued for a stall that sold nothing and the answer was that the queue was the point" },
        { id: "c", label: "Break it up.", need: { stat: "power", min: 7 }, debt: 2, tag: "broke up a queue for a stall that sold nothing and was, for the first time down there, genuinely disliked" },
      ]},
      { id: "m9", text: "Someone owes you. You did not know that. They have been waiting on this floor specifically to pay it.", options: [
        { id: "a", label: "Take the payment.", debt: -2, tag: "collected a debt they had not known they were owed, from someone who had been waiting on the third floor to pay it" },
        { id: "b", label: "Forgive it.", debt: 0, tag: "forgave a debt on the third floor, in front of a collector, which caused a small amount of trouble" },
        { id: "c", label: "Ask what it was for.", debt: 0, tag: "asked what the debt owed to them had been for and did not recognise a single detail of the story" },
      ]},
      { id: "m10", text: "A trader will tell you exactly how much longer you have down here. The price is small and the number is real.", options: [
        { id: "a", label: "Pay. Ask.", debt: 2, tag: "paid a third-floor trader to be told exactly how long they had left down there, and carried the number the rest of the way" },
        { id: "b", label: "Refuse to know.", debt: 0, tag: "was offered the exact length of their sentence and refused to be told" },
        { id: "c", label: "Ask if it can change.", need: { stat: "special", min: 6 }, debt: 0, tag: "asked whether the number could change, and was told yes, which was worse than no" },
      ]},
      { id: "m11", text: "You are offered a contract with no visible downside. You read it three times. There genuinely isn't one.", options: [
        { id: "a", label: "Sign it.", debt: 2, tag: "signed a contract on the third floor with no visible downside, and the downside was not visible for a very long time" },
        { id: "b", label: "Refuse anyway.", debt: 0, tag: "refused a contract with no downside purely because it had no downside, which the other party respected" },
        { id: "c", label: "Ask who benefits.", need: { stat: "special", min: 8 }, debt: -1, tag: "asked who actually benefited from a contract with no downside, and was answered honestly, and did not sign" },
      ]},
      { id: "m12", text: "A stallholder recognises the folded paper in your pocket. He goes very still and then asks, quietly, who gave it to you.", options: [
        { id: "a", label: "Tell him.", debt: 0, tag: "told a third-floor stallholder where the folded paper had come from and watched him decide not to say what he knew" },
        { id: "b", label: "Say nothing.", debt: 0, tag: "refused to say who had given them the folded paper, and the stallholder approved of that" },
        { id: "c", label: "Show it to him.", need: { stat: "special", min: 6 }, debt: -1, tag: "showed the folded paper to a stallholder who read it, corrected one line of it, and handed it back" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "quiet",
    title: "FLOOR FOUR — THE QUIET",
    feel: "Where the dead go who cannot be near others. Vast, empty and still — and sound arrives late, or twice, or slightly changed. Nobody discusses it.",
    scenes: [
      { id: "q1", text: "Nothing happens here. Not as a threat — nothing simply happens, for a very long time, and the ones who break are the ones who tried to fill it.", options: [
        { id: "a", label: "Hold one clean thought.", need: { stat: "hp", min: 6 }, debt: 0, tag: "spent a century on the fourth floor holding a single unbroken thought, and came out unreadable" },
        { id: "b", label: "Count something.", debt: 0, tag: "counted through the silence of the fourth floor, and the number is still in their head" },
        { id: "c", label: "Talk to fill it.", debt: 1, tag: "tried to talk through the silence of the fourth floor, which is the mistake everyone makes once" },
      ]},
      { id: "q2", text: "Your own footsteps arrive a second after you take them. You stop. They stop, a second later.", options: [
        { id: "a", label: "Keep walking. Ignore it.", debt: 0, tag: "walked the fourth floor for a long time with their own footsteps arriving a second late, and refused to acknowledge it" },
        { id: "b", label: "Test it deliberately.", need: { stat: "special", min: 6 }, debt: 0, tag: "spent a week on the fourth floor testing exactly how late their own footsteps were, and the delay was consistent, which was the unsettling part" },
        { id: "c", label: "Stand completely still.", debt: 0, tag: "stood entirely still on the fourth floor until the last of their own footsteps had finished arriving" },
      ]},
      { id: "q3", text: "There is a hall here that is empty and has been swept. Somebody sweeps it. You never see them.", options: [
        { id: "a", label: "Wait for the sweeper.", need: { stat: "hp", min: 7 }, debt: 0, tag: "waited a very long time on the fourth floor to see who swept an empty hall, and never did, and stopped needing to" },
        { id: "b", label: "Leave it alone.", debt: 0, tag: "found a swept hall on the fourth floor with nobody in it and decided not to find out who kept it clean" },
        { id: "c", label: "Make a mark on the floor.", debt: 1, tag: "left a deliberate mark on the fourth floor to see if it would be cleaned, and it was, and they never learned when" },
      ]},
      { id: "q4", text: "Someone is out here alone by choice. They have been for a long time. They do not want company and they are not unkind about it.", options: [
        { id: "a", label: "Respect it. Move on.", debt: 0, tag: "left someone alone on the fourth floor because they had asked to be, and did not take it personally" },
        { id: "b", label: "Sit at a distance.", debt: -1, tag: "sat down at a respectful distance from someone who wanted to be alone on the fourth floor, and stayed, and eventually was spoken to" },
        { id: "c", label: "Ask why.", debt: 1, tag: "asked someone on the fourth floor why they had chosen to be alone, and got an answer about noise" },
      ]},
      { id: "q5", text: "A sound arrives that you did not make. It is far away and it is not repeated and nothing on this floor is closer than the horizon.", options: [
        { id: "a", label: "Walk toward it.", need: { stat: "power", min: 6 }, debt: 1, tag: "walked toward a sound on the fourth floor that nothing could have made, for three days, and found the place it would have come from, and it was empty" },
        { id: "b", label: "Walk away from it.", debt: 0, tag: "heard something on the fourth floor and went the other way without discussing it with themselves" },
        { id: "c", label: "Wait to hear it again.", debt: 0, tag: "waited on the fourth floor to hear a sound a second time and it did not come, which was somehow the worse outcome" },
      ]},
      { id: "q6", text: "You realise you have not spoken in long enough that you have to try your own voice to check it still works.", options: [
        { id: "a", label: "Say your own name.", debt: 0, tag: "broke a very long silence on the fourth floor by saying their own name out loud, to check, and it came out right" },
        { id: "b", label: "Say nothing. Don't check.", need: { stat: "hp", min: 7 }, debt: 0, tag: "went so long without speaking on the fourth floor that they stopped checking whether they still could" },
        { id: "c", label: "Sing.", debt: 0, tag: "sang on the fourth floor, badly and at length, and the sound came back a few seconds later slightly better than they had managed" },
      ]},
      { id: "q7", text: "There is something out here that has been here longer than the floor has had a name. It is not doing anything. It does not like being looked at.", options: [
        { id: "a", label: "Look away. Keep going.", debt: 0, tag: "encountered the thing that lives on the fourth floor, looked away immediately, and kept walking, which is the correct procedure" },
        { id: "b", label: "Look at it anyway.", need: { stat: "hp", min: 8 }, debt: 2, tag: "looked directly at the thing on the fourth floor for as long as they could manage, and it did nothing at all, and that was the frightening part" },
        { id: "c", label: "Speak to it.", need: { stat: "special", min: 8 }, debt: 1, tag: "spoke to the thing on the fourth floor. It did not answer. But it moved slightly, which the clerks upstairs did not believe" },
      ]},
      { id: "q8", text: "The Long-Stayers are out here. They don't attack. They are simply very interested in you, and time goes strange around them.", options: [
        { id: "a", label: "Talk to one. Briefly.", debt: 1, tag: "spoke with one of the Long-Stayers on the fourth floor for what felt like an afternoon, and lost a decade to it" },
        { id: "b", label: "Give them a wide berth.", debt: 0, tag: "gave the Long-Stayers a wide berth on the fourth floor, having been told once what they cost" },
        { id: "c", label: "Ask one how long.", need: { stat: "special", min: 7 }, debt: 2, tag: "asked a Long-Stayer how long they had been down there, and the answer took years to finish" },
      ]},
      { id: "q9", text: "You find a place where the quiet is complete — no delay, no echo, nothing arriving late. It is the only spot like it and it is very small.", options: [
        { id: "a", label: "Stay in it a while.", debt: -1, tag: "found the one place on the fourth floor where sound behaved properly, and stayed in it as long as they could stand" },
        { id: "b", label: "Mark it and move on.", debt: 0, tag: "marked the one quiet spot on the fourth floor and moved on, and could never find it again on the way back" },
        { id: "c", label: "Leave immediately.", debt: 0, tag: "left the only correct-sounding place on the fourth floor almost at once, because it was worse than the wrongness" },
      ]},
      { id: "q10", text: "A hundred years pass. You notice afterwards. At the time it did not feel like anything at all.", options: [
        { id: "a", label: "Accept it.", debt: 0, tag: "lost a hundred years on the fourth floor without noticing at the time, and accepted it afterwards without much fuss" },
        { id: "b", label: "Work out where it went.", need: { stat: "special", min: 7 }, debt: 0, tag: "reconstructed where a missing hundred years had gone on the fourth floor, and the reconstruction was worse than not knowing" },
        { id: "c", label: "Start counting from now.", debt: 0, tag: "began counting the days on the fourth floor only after losing a century of them, and never missed one afterwards" },
      ]},
      { id: "q11", text: "On the way off the floor, something behind you says your name. Correctly. Including the part the clerk got wrong at Intake.", options: [
        { id: "a", label: "Don't turn around.", debt: 0, tag: "was called by their full and correct name while leaving the fourth floor, including the syllable the clerk had got wrong, and did not turn around" },
        { id: "b", label: "Turn around.", need: { stat: "hp", min: 8 }, debt: 1, tag: "turned around when something on the fourth floor said their name correctly, and there was nobody there, and the name had still been right" },
        { id: "c", label: "Answer it.", need: { stat: "power", min: 8 }, debt: 2, tag: "answered when the fourth floor said their name, out loud, and nothing came of it, and something has known the name ever since" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "archive",
    title: "FLOOR FIVE — THE ARCHIVE",
    feel: "Every debt anyone ever carried, filed. A room of books that goes back further than the room does. Things here are recorded before they happen, and the clerks find that unremarkable.",
    scenes: [
      { id: "a1", text: "A clerk turns a page and finds your name already there. Not added — printed, in the same hand as everything around it.", options: [
        { id: "a", label: "Pay what you owe. All of it.", debt: -99, tag: "found their own name already in the great ledger, paid every mark of it, and left the fifth floor owing nothing" },
        { id: "b", label: "Argue the arithmetic.", need: { stat: "special", min: 8 }, debt: -1, tag: "argued the arithmetic in the great ledger and was correct about one line of it, which the clerk noted in the margin" },
        { id: "c", label: "Close the book and walk on.", debt: 2, tag: "closed the book on their own name without reading the total, and carried it down with them" },
      ]},
      { id: "a2", text: "The shelves go back past where the room ends. You can see them continuing. The wall is behind them.", options: [
        { id: "a", label: "Follow the shelves.", need: { stat: "special", min: 7 }, debt: 0, tag: "followed the archive shelves past the point where the room ended, for as long as they could, and the shelves kept going" },
        { id: "b", label: "Ask a clerk about it.", debt: 0, tag: "asked an archive clerk why the shelves went past the wall, and was told that the wall was newer" },
        { id: "c", label: "Don't look at it.", debt: 0, tag: "deliberately did not look at where the archive shelves went past the wall, and got their business done quickly" },
      ]},
      { id: "a3", text: "There is a ledger of things that have not happened yet. It is filed with the rest. Nobody treats it as remarkable.", options: [
        { id: "a", label: "Don't open it.", debt: 0, tag: "declined to open the ledger of things that had not happened yet, and the clerk said most people do open it" },
        { id: "b", label: "Look up your own name.", need: { stat: "hp", min: 7 }, debt: 1, tag: "looked themselves up in the ledger of things that had not happened yet, read one line, and closed it" },
        { id: "c", label: "Look up someone else's.", debt: 2, tag: "looked up somebody else in the ledger of what had not happened yet, which is not illegal down there and is not forgotten either" },
      ]},
      { id: "a4", text: "A clerk asks, without any particular emphasis, whether you would like to see who bought your debt.", options: [
        { id: "a", label: "Yes.", debt: 0, tag: "asked to see who owned their debt and was shown a name they recognised from the living world, written in excellent handwriting" },
        { id: "b", label: "No.", debt: 0, tag: "declined to find out who owned their debt, which the clerk recorded as declined rather than as unknown" },
        { id: "c", label: "Ask what it would cost to buy it back.", need: { stat: "special", min: 7 }, debt: -2, tag: "asked what it would cost to buy their own debt back, was given a real figure, and paid part of it on the spot" },
      ]},
      { id: "a5", text: "Someone else's file is open on the desk and it is enormous. The name on it is one you were given upstairs.", options: [
        { id: "a", label: "Read it.", debt: 2, tag: "read a stranger's file on the fifth floor because they had been given the name upstairs, and understood why they had been asked to look" },
        { id: "b", label: "Close it.", debt: 0, tag: "closed a stranger's file on the fifth floor without reading it, and reported honestly afterwards that they had not looked" },
        { id: "c", label: "Ask the clerk about them.", debt: 0, tag: "asked an archive clerk about a name they had been given, and the clerk's whole manner changed for about four seconds" },
      ]},
      { id: "a6", text: "There is a section for debts that were forgiven. It is very small and it is kept beautifully.", options: [
        { id: "a", label: "Read some of them.", debt: -1, tag: "spent time in the small, beautifully kept section of the archive reserved for debts that were forgiven" },
        { id: "b", label: "Ask why it's so small.", debt: 0, tag: "asked why the forgiven-debts section of the archive was so small, and the clerk said it was not small, it was complete" },
        { id: "c", label: "Add something to it.", need: { stat: "hp", min: 7 }, debt: -2, tag: "forgave a debt they were owed and had it entered into the smallest section of the archive, which required three signatures" },
      ]},
      { id: "a7", text: "A clerk has been filing here since before there was a word for what she does. She asks how things are upstairs.", options: [
        { id: "a", label: "Tell her honestly.", debt: -1, tag: "told an archive clerk who predated the word for her job exactly how things were upstairs, and she listened to all of it" },
        { id: "b", label: "Ask her what changed.", need: { stat: "special", min: 6 }, debt: 0, tag: "asked the oldest clerk in the archive what had changed since she started, and the answer was: the handwriting" },
        { id: "c", label: "Say things are fine.", debt: 0, tag: "told the oldest clerk in the archive that things upstairs were fine, and she wrote that down, which was worse" },
      ]},
      { id: "a8", text: "Your file has an entry you cannot account for, dated a long time before you were born.", options: [
        { id: "a", label: "Query it.", need: { stat: "special", min: 7 }, debt: 0, tag: "formally queried an entry in their own file dated long before their birth, and the query was accepted and never answered" },
        { id: "b", label: "Leave it.", debt: 0, tag: "found an entry in their own file predating their birth and left it exactly where it was" },
        { id: "c", label: "Have it struck out.", debt: 3, tag: "had an entry struck from their own file without knowing what it was, which cost more than anything else on the descent" },
      ]},
      { id: "a9", text: "Two clerks are quietly disagreeing about which of two identical files is the real one. Both have your name.", options: [
        { id: "a", label: "Insist on the older one.", need: { stat: "special", min: 6 }, debt: 0, tag: "insisted the older of two identical files was theirs, argued it successfully, and does not know to this day whether they were right" },
        { id: "b", label: "Let them decide.", debt: 1, tag: "let two clerks decide which of two identical files was really theirs, and did not ask which one they chose" },
        { id: "c", label: "Ask for both.", debt: 2, tag: "asked to be given both of the files bearing their name, which was permitted, and which has never fully been undone" },
      ]},
      { id: "a10", text: "The folded paper from Intake matches a page here exactly. The clerk looks at both for a while.", options: [
        { id: "a", label: "Hand the paper over.", debt: -2, tag: "handed over the folded paper from Intake when it turned out to match a page in the archive, and the matter was closed the same day" },
        { id: "b", label: "Keep it.", debt: 1, tag: "kept the folded paper even after it matched a page in the archive exactly, and the clerk allowed it, and made a note" },
        { id: "c", label: "Ask who wrote both.", need: { stat: "special", min: 8 }, debt: 0, tag: "asked who had written both the folded paper and the matching archive page, and the clerk said it was the same hand, and would not say whose" },
      ]},
      { id: "a11", text: "You are told your account can be closed today. The clerk stamps it CLOSED and says, 'You leave this floor owing nothing.'", options: [
        { id: "a", label: "Say thank you.", debt: -99, tag: "had their account stamped closed on the fifth floor, said thank you, and meant it" },
        { id: "b", label: "Say: 'I know.'", debt: -99, tag: "was told they would leave the fifth floor owing nothing and said 'I know', which the clerk did not enjoy" },
        { id: "c", label: "Ask what closed means here.", need: { stat: "special", min: 7 }, debt: -1, tag: "asked what closed actually meant in the archive, and the answer was that it meant closed, and that it could be reopened" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "stair",
    title: "FLOOR SIX — THE OUTER STAIR",
    feel: "The last inhabited floor. Fewer people, older people, and a persistent sense of being looked at from below. Nobody who works this floor stays longer than they must.",
    scenes: [
      { id: "s1", text: "The way back is a stair, it is not hidden, and nobody stops you. One flight further down, past where the stair turns, there is a door. It is shut. You can see it from here.", options: [
        { id: "a", label: "Climb. Don't look down.", debt: 0, tag: "climbed out without once looking at what was below the stair" },
        { id: "b", label: "Look at the door. Then climb.", debt: 0, tag: "stopped on the stair and looked at the shut door for a long moment before climbing out — and has never described what they saw, because there was nothing to see, and that is the part that stayed with them" },
        { id: "c", label: "Sit down. Not yet.", need: { stat: "hp", min: 8 }, debt: -1, tag: "sat down within sight of the way out and stayed a while longer on purpose" },
      ]},
      { id: "s2", text: "The last people who work down here are old and none of them face the stairwell while they eat.", options: [
        { id: "a", label: "Sit with your back to it too.", debt: 0, tag: "ate with their back to the stairwell on the sixth floor because everyone else did, and did not ask why until much later" },
        { id: "b", label: "Ask why they sit like that.", debt: 0, tag: "asked why nobody on the sixth floor faces the stairwell, and was told it was just more comfortable" },
        { id: "c", label: "Face it deliberately.", need: { stat: "hp", min: 7 }, debt: 1, tag: "deliberately sat facing the sixth-floor stairwell through an entire meal, alone, while everyone else did not" },
      ]},
      { id: "s3", text: "There is a post here. Someone stood at it for a very long time and does not now. The chair is still warm in the way that furniture is never warm down here.", options: [
        { id: "a", label: "Don't touch anything.", debt: 0, tag: "found an abandoned post near the bottom of Purgatory and touched nothing at all" },
        { id: "b", label: "Sit in the chair.", need: { stat: "hp", min: 8 }, debt: 1, tag: "sat down in a chair at an abandoned post at the bottom of Purgatory, briefly, and got up again quite quickly" },
        { id: "c", label: "Ask who stood here.", need: { stat: "special", min: 7 }, debt: 0, tag: "asked who had stood at the post near the bottom of the stair, and the answer was that there used to be more of them" },
      ]},
      { id: "s4", text: "A woman on this floor has been waiting for someone to come UP the stair. She has been waiting a long time and she is quite certain.", options: [
        { id: "a", label: "Wait with her a while.", debt: -1, tag: "waited a while on the sixth floor with a woman who was expecting someone to come up the stair, and nobody did" },
        { id: "b", label: "Tell her nobody comes up.", debt: 1, tag: "told a woman on the sixth floor that nothing comes up the stair, and she said that she knew, and kept waiting" },
        { id: "c", label: "Ask who she's waiting for.", debt: 0, tag: "asked a woman at the bottom of Purgatory who she was waiting for, and she gave a description rather than a name" },
      ]},
      { id: "s5", text: "The persistent sense of being looked at gets briefly stronger and then goes back to normal. Nobody around you reacts.", options: [
        { id: "a", label: "Carry on as normal.", debt: 0, tag: "felt the attention on the sixth floor sharpen and then ease, and carried on as though nothing had happened, like everyone else" },
        { id: "b", label: "Ask if anyone else felt it.", debt: 0, tag: "asked whether anyone else on the sixth floor had felt that, and several people said no in a way that meant yes" },
        { id: "c", label: "Look down the stair.", need: { stat: "hp", min: 7 }, debt: 1, tag: "looked down the stair at the moment the attention sharpened, and saw the door, shut, exactly as it had been" },
      ]},
      { id: "s6", text: "There is a logbook at the foot of the stair. Every entry is a date and the word NOTHING, in a great many different hands.", options: [
        { id: "a", label: "Add your entry.", debt: 0, tag: "signed the logbook at the foot of the stair with the date and the word NOTHING, in a book where every entry said the same" },
        { id: "b", label: "Read back through it.", need: { stat: "special", min: 6 }, debt: 0, tag: "read back through a logbook at the foot of the stair where every entry for ten thousand years said NOTHING, and found no exceptions" },
        { id: "c", label: "Leave it blank.", debt: 1, tag: "declined to sign the logbook at the foot of the stair, which broke a sequence that had been unbroken for a very long time" },
      ]},
      { id: "s7", text: "Somebody is going down. Not to the door — past it, they say, on business. They are entirely calm and they do not come back while you are here.", options: [
        { id: "a", label: "Let them go.", debt: 0, tag: "watched someone descend past the door on business and did not ask what business, and never saw them again" },
        { id: "b", label: "Ask what's down there.", debt: 1, tag: "asked someone heading past the door what was down there, and they answered a different question, pleasantly" },
        { id: "c", label: "Offer to go with them.", need: { stat: "power", min: 8 }, debt: 2, tag: "offered to accompany someone past the door and was turned down flatly and without explanation, which was the only unkind thing anyone said to them down there" },
      ]},
      { id: "s8", text: "The stair up is longer than the stair down was. Everyone here already knows this and nobody has ever measured it.", options: [
        { id: "a", label: "Just climb.", debt: 0, tag: "climbed a stair that was longer going up than it had been coming down, and did not comment on it" },
        { id: "b", label: "Measure it.", need: { stat: "special", min: 7 }, debt: 0, tag: "counted the steps in both directions and confirmed that the stair out of Purgatory is longer than the stair in" },
        { id: "c", label: "Ask why.", debt: 0, tag: "asked why the stair out was longer than the stair in and was told that most people are carrying more on the way up" },
      ]},
      { id: "s9", text: "Someone gives you something small to carry up. They ask you to put it somewhere specific in the living world. They do not explain.", options: [
        { id: "a", label: "Take it.", debt: 0, tag: "agreed to carry something small out of Purgatory and leave it somewhere specific in the living world, without being told why" },
        { id: "b", label: "Refuse.", debt: 0, tag: "refused to carry anything out of Purgatory on behalf of the dead, politely, and was not pressed" },
        { id: "c", label: "Ask what it is.", need: { stat: "special", min: 6 }, debt: 0, tag: "asked what they were being asked to carry out, was told exactly, and took it anyway" },
      ]},
      { id: "s10", text: "There is a mark on the wall by the stair at about head height. It is worn smooth. A great many people have touched it on the way up.", options: [
        { id: "a", label: "Touch it too.", debt: 0, tag: "touched the worn mark by the stair on the way out, the way everyone does, without knowing what it was for" },
        { id: "b", label: "Don't.", debt: 0, tag: "walked past the worn mark by the stair without touching it, and was the only one that day who did not" },
        { id: "c", label: "Ask what it is.", debt: 0, tag: "asked what the worn mark by the stair meant, and was told that it did not mean anything, it was just where people put their hand" },
      ]},
      { id: "s11", text: "At the top of the stair the light changes. Not brightens — changes. Somebody behind you says, 'Go on then.'", options: [
        { id: "a", label: "Go without looking back.", debt: 0, tag: "went up the last of the stair without looking back when somebody told them to go on" },
        { id: "b", label: "Look back once.", debt: 0, tag: "looked back once from the top of the stair, and the sixth floor was going about its business exactly as before" },
        { id: "c", label: "Say goodbye properly.", need: { stat: "hp", min: 6 }, debt: -1, tag: "said a proper goodbye at the top of the stair, by name, to people who had not been said goodbye to in a very long time" },
      ]},
    ],
  },

  // ==========================================================================
  {
    id: "vestibule",
    title: "FLOOR SEVEN — THE VESTIBULE",
    feel: "Not administrative. Nobody lives here. There is a stair, and at the bottom of it a shut door, and something has always been posted at it.",
    // 🔒 The door NEVER opens. Nothing is ever described from the far side.
    // A character may stand here and look. That is the entire permitted range.
    scenes: [
      { id: "v1", text: "You are not supposed to be able to get this far and nothing stopped you. The door is shut. It has always been shut.", options: [
        { id: "a", label: "Look, and go back up.", debt: 0, tag: "reached the shut door at the bottom of everything, looked at it, and went back up without touching it" },
        { id: "b", label: "Put a hand on it.", need: { stat: "hp", min: 8 }, debt: 1, tag: "put one hand flat against the shut door at the bottom of Purgatory. It was the temperature of the room. They have never described it further" },
        { id: "c", label: "Turn back before you reach it.", debt: 0, tag: "got within sight of the shut door and turned back before reaching it, deliberately, and has never regretted that" },
      ]},
      { id: "v2", text: "There is no handle on this side.", options: [
        { id: "a", label: "Note it. Say nothing.", debt: 0, tag: "noticed that the door at the bottom has no handle on this side, and did not mention it to anyone upstairs" },
        { id: "b", label: "Look for one anyway.", need: { stat: "special", min: 7 }, debt: 1, tag: "searched the shut door thoroughly for a handle, found nothing, and understood what that meant about which side it opens from" },
        { id: "c", label: "Leave immediately.", debt: 0, tag: "saw that the door had no handle on this side and left the seventh floor at once" },
      ]},
      { id: "v3", text: "Something is posted here. It does not challenge you. It has been at this post a very long time and it is not, as far as you can tell, waiting for you.", options: [
        { id: "a", label: "Nod. Move on.", debt: 0, tag: "acknowledged whatever stands at the last post and was acknowledged in return, and neither of them said anything" },
        { id: "b", label: "Ask what it's guarding.", need: { stat: "special", min: 8 }, debt: 1, tag: "asked what the last post was guarding and received an answer that was not about the door, and has never repeated it" },
        { id: "c", label: "Don't approach it.", debt: 0, tag: "kept their distance from whatever stands at the last post, which appeared to be the preferred arrangement" },
      ]},
      { id: "v4", text: "It is completely silent here. After the fourth floor you notice that this silence is the ordinary kind, and that is somehow worse.", options: [
        { id: "a", label: "Stay a moment in it.", need: { stat: "hp", min: 7 }, debt: 0, tag: "stood for a while in the ordinary silence at the bottom of Purgatory, which after the fourth floor was the strangest thing down there" },
        { id: "b", label: "Go back up at once.", debt: 0, tag: "found the silence at the bottom of the stair completely ordinary and went back up faster than they had come down" },
        { id: "c", label: "Listen to the door.", need: { stat: "special", min: 8 }, debt: 1, tag: "listened at the shut door for a long time and heard nothing whatsoever, and reports that the nothing was very complete" },
      ]},
      { id: "v5", text: "The stair does not continue past the door. This is the bottom of the building. It is not the bottom of everything, and you can tell.", options: [
        { id: "a", label: "Accept that and climb.", debt: 0, tag: "understood at the bottom of the stair that the building ended there and that something else did not, and climbed out" },
        { id: "b", label: "Work out how you can tell.", need: { stat: "special", min: 8 }, debt: 1, tag: "tried to work out how they could tell there was more below the bottom floor, could not, and remained certain" },
        { id: "c", label: "Don't think about it.", debt: 0, tag: "declined to think about what was below the lowest floor, which is the standing advice down there and is followed by almost nobody" },
      ]},
      { id: "v6", text: "Somebody has left flowers at the foot of the door. They are not fresh and they are not old. Nobody comes down here.", options: [
        { id: "a", label: "Leave them be.", debt: 0, tag: "found flowers at the foot of the shut door, left by nobody, and left them exactly as they were" },
        { id: "b", label: "Add something.", debt: -1, tag: "added something of their own to the flowers at the foot of the shut door, and could not have explained why" },
        { id: "c", label: "Ask upstairs about them.", debt: 0, tag: "asked upstairs who leaves flowers at the shut door, and three separate people said they had never heard of anyone doing that" },
      ]},
      { id: "v7", text: "You have the strong and specific sense that the door is not locked. Merely shut.", options: [
        { id: "a", label: "Leave it shut.", debt: 0, tag: "understood that the door at the bottom was not locked, only shut, and left it shut" },
        { id: "b", label: "Tell someone upstairs.", debt: 0, tag: "reported upstairs that the door at the bottom is not locked, and was thanked, and nothing appeared to be done" },
        { id: "c", label: "Say nothing to anyone. Ever.", need: { stat: "hp", min: 8 }, debt: -1, tag: "worked out that the door at the bottom is not locked and has never told a single person, living or dead" },
      ]},
      { id: "v8", text: "On the way back up, the door is exactly as it was. You check twice. It is the checking that stays with you.", options: [
        { id: "a", label: "Stop checking. Climb.", debt: 0, tag: "checked the shut door twice on the way out, made themselves stop, and climbed" },
        { id: "b", label: "Check a third time.", debt: 1, tag: "checked the shut door a third time on the way out. It was shut. It has always been shut. They checked anyway" },
        { id: "c", label: "Don't look back at all.", need: { stat: "hp", min: 7 }, debt: 0, tag: "did not look back at the door once on the way out, which took more effort than the entire climb" },
      ]},
    ],
  },
];

// 12 + 12 + 12 + 11 + 11 + 11 + 8 = 77.
export const PURGATORY_SCENE_COUNT = PURGATORY_FLOORS.reduce((n, f) => n + f.scenes.length, 0);
