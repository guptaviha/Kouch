import { getData } from '@/utils/neon/server';

export default async function ExampleComponentFetchingData({  }) {
    // const data = await getData() || [];
    // return <div>
    //     <h3>Data fetched from Neon will show up here</h3>
    //     <h4>Edit the example component with an actual table name and print the data</h4>
    //     <pre>{JSON.stringify(data)}</pre>
    // </div>
    return <div>
        <h3>Data fetching example component</h3>
        <h4>Edit the example component with an actual table name and print the data</h4>
    </div>
}