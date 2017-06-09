const TrelloHandler = index.TrelloHandler;
const DateFormat = index.DateFormat;

const lists = {
    mutes: '59392e154996d41c2127c335',
    kicks: '59392e1330235b9cc7a28f94',
    bans: '59392e1037e46c4d8b1af98c',
};

const labels = {
    reverted: '59396434a65061821399b435',
};

/*

    -UnMute
        -Mark last card for that user as dueComplete

    -Mute
        -Mark last card for that user as dueComplete
        -Create new card

    -IncMute
        -Change due date to new date

    -UndoMute
        -Mark last card for that user as dueComplete
        -Mark last card for that user with 'Undone' label

*/

exports.cardCache = [];

function fixDesc(cardDesc) {
    let cardDescStr;

    if (Util.isObject(cardDesc)) {
        const cardDescNew = [];

        for (const [key, value] of Object.entries(cardDesc)) {
            if (typeof key === 'number') {
                cardDescNew.push(`${value}`);
            } else {
                cardDescNew.push(`${key}: ${value}`);
            }
        }

        cardDescStr = cardDescNew.join('\n\n');
    } else {
        cardDescStr = cardDesc;
    }

    cardDescStr = cardDescStr.substr(0, 16384);

    return cardDescStr;
}

function getStampFromId(id) {
    return 1000 * parseInt(id.substring(0, 8), 16);
}

function sortCards(a, b) { // Newest first
    return b.stampCreated - a.stampCreated;
}

exports.findCard = function (targetId, callback) {
    for (let i = 0; i < exports.cardCache.length; i++) {
        if (exports.cardCache[i].targetId === targetId) {
            console.log('Found card from cache');
            callback(true, exports.cardCache[i].cardData);
            return undefined;
        }
    }

    TrelloHandler.get('/1/search', {
        query: targetId,
        modelTypes: 'cards',
        card_fields: 'desc',
        cards_limit: 1,
    }, (err, data) => {
        console.log('--[FindCard] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);
        console.log('--[FindCard] TRELLO FEEDBACK END--');

        const ok = err == null && data.cards.length > 0;

        if (ok) {
            const cardData = data.cards[0];
            const cardId = cardData.id;

            const stampCreated = getStampFromId(cardId);

            let alreadyExists = false;

            for (let i = 0; i < exports.cardCache.length; i++) {
                if (exports.cardCache[i].cardId === cardId) {
                    exports.cardCache[i].targetId = targetId;
                    alreadyExists = true;
                    break;
                }
            }

            if (!alreadyExists) {
                exports.cardCache.push({
                    'cardData': cardData,
                    'cardId': cardId,
                    'stampCreated': stampCreated,
                    'targetId': targetId,
                });

                exports.cardCache.sort(sortCards);
            }

            callback(ok, cardData);
        } else {
            callback(ok, err);
        }
    });

    return undefined;
};

exports.dueComplete = function (cardId, callback) {
    TrelloHandler.put(`/1/cards/${cardId}/dueComplete`, {
        value: true,
    }, (err, data) => {
        console.log('--[DueComplete] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);
        console.log('--[DueComplete] TRELLO FEEDBACK END--');

        if (callback) callback();
    });
};

exports.setDesc = function (cardId, cardDesc) {
    cardDesc = fixDesc(cardDesc);

    TrelloHandler.put(`/1/cards/${cardId}/desc`, {
        value: cardDesc,
    }, (err, data) => {
        console.log('--[SetDesc] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);
        console.log('--[SetDesc] TRELLO FEEDBACK END--');
    });
};

exports.setDue = function (cardId, dueDate) {
    TrelloHandler.put(`/1/cards/${cardId}/due`, {
        value: dueDate,
    }, (err, data) => {
        console.log('--[SetDue] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);
        console.log('--[SetDue] TRELLO FEEDBACK END--');
    });
};

exports.addLabel = function (cardId, labelName) {
    labelName = labelName.toLowerCase();

    if (!has.call(labels, labelName)) {
        console.log(`Label ${labelName} does not exist`);
        return false;
    }

    const labelId = labels[labelName];

    TrelloHandler.post(`/1/cards/${cardId}/idLabels`, {
        value: labelId,
    }, (err, data) => {
        console.log('--[AddLabel] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);
        console.log('--[AddLabel] TRELLO FEEDBACK END--');
    });

    return true;
};

exports.addCard = function (listName, cardName, cardDesc, dueDate) {
    listName = listName.toLowerCase();

    if (!has.call(lists, listName)) {
        console.log(`List ${listName} does not exist`);
        return false;
    }

    if (dueDate == null) dueDate = null;

    const id = cardDesc['User ID'];

    cardDesc = fixDesc(cardDesc);

    const listId = lists[listName];
    const nowDate = new Date();
    const nowDateStr = DateFormat(nowDate, '[dd/mm/yyyy]');

    TrelloHandler.post('/1/cards', {
        idList: listId,
        name: `${nowDateStr} ${cardName}`,
        desc: cardDesc,
        pos: 'top',
        due: dueDate,
    }, (err, data) => {
        console.log('--[AddCard] TRELLO FEEDBACK START--');
        console.log(err);
        console.log('--<>--');
        console.log(data);

        console.log('--[AddCard] TRELLO FEEDBACK END--');

        if (!err && data) {
            const cardId = data.id;
            const stampCreated = getStampFromId(cardId);

            exports.cardCache.push({
                'cardData': data,
                'cardId': cardId,
                'stampCreated': stampCreated,
                'targetId': id != null ? id : null,
            });
        }
    });

    return true;
};
