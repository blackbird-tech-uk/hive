package com.blackbird.hiveagent.data.network

import com.blackbird.hiveagent.BuildConfig
import com.blackbird.hiveagent.data.local.TokenStorage
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    private val logging =
        HttpLoggingInterceptor().apply {
            level =
                if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
        }

    private val client =
        OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()

    fun create(
        serverUrl: String,
    ): HiveApi {
        val normalisedUrl =
            TokenStorage.normaliseServerUrl(
                serverUrl,
            )

        return Retrofit.Builder()
            .baseUrl("$normalisedUrl/")
            .client(client)
            .addConverterFactory(
                GsonConverterFactory.create(),
            )
            .build()
            .create(HiveApi::class.java)
    }

    val api: HiveApi
        get() = create(
            BuildConfig.API_BASE_URL,
        )
}