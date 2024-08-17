import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';

const baseurl = 'https://crypto-market-health.p.rapidapi.com';

type Exchange = {
    [key: string]: string;
}

type Pair = {
    [key: string]: `${string}-${string}`;
}

interface IMetrics {
    timestamp: string;
    marketvenueid: string;
    pairid: string;
    vwap: number;
    tradecount: number;
    buysellratio: number;
    buysellratioabs: number;
    timeoftrade: {
        seconds: number[];
    };
    firstdigitdist: {
        [key: string]: number;
    };
    benfordlawtest: number;
    volumedist: number[][];
}

interface IMetricsRequest {
    marketvenueid: string;
    pairid: string;
    start: string;
    end: string;
    sort: string;
    limit: number;
    page: number;
}

interface IDictionary {
    marketvenueid: string;
    pairid: string;
    type: string;
}

interface IDictionaryRequest {
    marketvenueid: string;
    pairid: string;
    limit: number;
    page: number;
}

function isIMetrics(obj: any): obj is IMetrics {
    return (
        typeof obj.timestamp === 'string' &&
        typeof obj.marketvenueid === 'string' &&
        typeof obj.pairid === 'string' &&
        typeof obj.vwap === 'number'
    );
}

function isDictionary(obj: any): obj is IDictionary {
    return (
        typeof obj.marketvenueid === 'string' &&
        typeof obj.pairid === 'string' &&
        typeof obj.type === 'string'
    );
}

async function main() {
    const startDate = '2024-08-15';
    const endDate = '2024-08-16';
    const limit = 100;
    

    let metrics: IMetrics[] = [];
    const totalPages = calculateTotalPages(startDate, endDate, limit);
    for (let i = 0; i < totalPages; i++) {
        const params: IMetricsRequest = {
            marketvenueid: 'binance',
            pairid: 'btc-usdt',
            start: startDate,
            end: endDate,
            sort: 'asc',
            limit: limit,
            page: i + 1
        };

        try {
            metrics = metrics.concat(await getMetrics(params));
            if (!Array.isArray(metrics)) {
                console.log(metrics);
                throw new Error(`Invalid response data`);
            }
        } catch (error) {
            console.error(error);
        }
    }
    
    for (const metric of metrics) {
        console.log(metric.timestamp);
    }
    console.log("Metrics length: ", metrics.length);
    // let dictionary: IDictionary[] = [];
    // try {
    //     dictionary = await getDictionary(Exchange.BINANCE, Pair.BTC_USDT, 'spot');
    // } catch (error) {
    //     console.error(error);
    // }
    // console.log(dictionary);
}

async function getMetrics(
    params: IMetricsRequest
): Promise<IMetrics[]> {
    const {
        marketvenueid,
        pairid,
        start,
        end,
        sort,
        limit,
        page,
    } = params;

    const url = `${baseurl}/metrics`;
    const options = {
        params: {
            marketvenueid,
            pairid,
            start,
            end,
            sort,
            limit,
            page
        },
        headers: {
            'x-rapidapi-key': '0e4765566cmshe89bec345fedb89p12fc0djsn9a61e68438a0',
            'x-rapidapi-host': 'crypto-market-health.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.get<IMetrics[]>(url, options);
        if (response.status !== 200) {
            throw new Error(`Failed to retrieve data`);
        }
        return response.data;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to retrieve data`);
    }
}

async function getDictionary(
    params: IDictionaryRequest
): Promise<IDictionary[]> {
    const {
        marketvenueid,
        pairid,
        limit,
        page,
    } = params;
    const url = `${baseurl}/dictionary`;
    const options = {
        params: {
            marketvenueid,
            pairid,
            limit,
            page
        },
        headers: {
            'x-rapidapi-key': '0e4765566cmshe89bec345fedb89p12fc0djsn9a61e68438a0',
            'x-rapidapi-host': 'crypto-market-health.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.get<IDictionary[]>(url, options);
        if (response.status !== 200) {
            throw new Error(`Failed to retrieve data`);
        }
        return response.data;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to retrieve data`);
    }
}

function calculateTotalPages(startDate: string, endDate: string, limit: number): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const diffInMilliseconds = end.getTime() - start.getTime();
    
    const diffInMinutes = Math.floor(diffInMilliseconds / 60000);
    
    const totalPages = Math.ceil(diffInMinutes / limit);
    
    return totalPages;
}

main();

