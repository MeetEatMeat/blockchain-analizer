import { verbose } from "sqlite3";
const sqlite3 = verbose();

interface Label {
    address: string;
    chainId: number;
    label: string;
    name?: string;
    symbol?: string;
    website?: string;
    image?: string;
}

async function returnData(address: string){
    console.log(await getLabelFromDB(address));
}

async function getLabelFromDB(address: string): Promise<Label | null> {
    const db = new sqlite3.Database('/Users/admin/nestjs-backend/blockchain-analizer/db.sqlite3', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Ошибка при подключении к базе данных:', err.message);
        } else {
            console.log('Подключение к базе данных успешно.');
        }
    });

    return new Promise((resolve, reject) => {
        db.get(
            "SELECT label, name, symbol, website, image FROM tokens WHERE address = ? UNION ALL SELECT label, name_tag as name, '' as symbol, '' as website, '' as image FROM accounts WHERE address = ?",
            [address.toLowerCase(), address.toLowerCase()],
            (err, row: Label) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            address: address,
                            chainId: 1,
                            label: row.label,
                            name: row.name,
                            symbol: row.symbol,
                            website: row.website,
                            image: row.image,
                        });
                    } else {
                        resolve(null);
                    }
                }
            }
        );

        db.close((err) => {
            if (err) {
                console.error('Ошибка при закрытии базы данных:', err.message);
            } else {
                console.log('Подключение к базе данных закрыто.');
            }
        });
    });
}

returnData('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
