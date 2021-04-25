const { V1Secret } = require('@kubernetes/client-node');
const k8s = require('@kubernetes/client-node');
const AWS = require('aws-sdk');
const fs = require('fs');

const ecr = new AWS.ECR({
  region: process.env.AWS_DEFAULT_REGION
})

const ns = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();


async function main() {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster()
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    console.log('[+] Configured k8s client')

    const token = (await new Promise((resolve, reject) => {
      ecr.getAuthorizationToken({}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      }); 
    })).authorizationData[0].authorizationToken;

    console.log('[+] Token received')

    const secret = new V1Secret()
    secret.apiVersion = 'v1';
    secret.kind = 'Secret';
    secret.metadata = {
      name: process.env.SECRET_NAME,
      namespace: ns,
      labels: {
        'created-by': 'ecr-k8s-generator'
      }
    };
    secret.type = 'kubernetes.io/dockerconfigjson'
    secret.data = {
      '.dockerconfigjson': Buffer.from(JSON.stringify({
        [process.env.REGISTRY]: {
          auth: token
        }
      })).toString('base64')
    }


    

    try {
      await k8sApi.readNamespacedSecret(process.env.SECRET_NAME, ns);
      console.log('[+] Secret already exists')
      await k8sApi.replaceNamespacedSecret(process.env.SECRET_NAME, ns, secret);
      console.log('[+] Secret replaced')
    } catch (e) {
      console.error('[-]', e)
      if (e.statusCode === 404) {
        try {
          console.log('[-] Secret not found')
          await k8sApi.createNamespacedSecret(ns, secret);
          console.log('[+] Secret created')
        } catch (error) {
          console.error(['-'], error)
        }
      }
    }
  } catch (e) {
    console.error('[-]', e);
  }

};

main();

